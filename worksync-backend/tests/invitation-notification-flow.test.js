import { jest } from '@jest/globals';
import { createFakePrisma } from './helpers/fakePrisma.js';

let prisma;
let invitationService;
let notificationService;
let authorizationService;

beforeAll(async () => {
  prisma = createFakePrisma();
  jest.unstable_mockModule('../src/config/database.js', () => ({
    prisma,
    connectDatabase: async () => { },
    disconnectDatabase: async () => { },
  }));

  invitationService = await import('../src/services/invitation.service.js');
  notificationService = await import('../src/services/notification.service.js');
  authorizationService = await import('../src/services/authorization.service.js');
});

async function seedWorkspaceWithOwner() {
  const owner = await prisma.user.create({
    data: { name: 'Owner Olu', email: 'owner@worksync.test', passwordHash: 'x' },
  });
  const workspace = await prisma.workspace.create({ data: { name: 'MarvinsStack', createdBy: owner.id } });
  await prisma.workspaceMember.create({ data: { workspaceId: workspace.id, userId: owner.id, role: 'OWNER' } });
  return { owner, workspace };
}

describe('invitation -> notification -> acceptance (integration)', () => {
  test('inviting an existing user creates the invitation and a linked in-app notification', async () => {
    const { owner, workspace } = await seedWorkspaceWithOwner();
    const invitee = await prisma.user.create({
      data: { name: 'Ivy Invitee', email: 'ivy@worksync.test', passwordHash: 'x' },
    });

    const { invitation, inviteUrl } = await invitationService.createInvitation(owner.id, workspace.id, {
      email: invitee.email,
      role: 'MEMBER',
    });

    expect(invitation.status).toBe('INVITED');
    expect(invitation.tokenHash).toBeTruthy();
    // The raw token must never be persisted — only its hash — but it IS
    // returned once, embedded in the URL, right here.
    expect(inviteUrl).toContain('/invitations/');
    expect(inviteUrl).not.toContain(invitation.tokenHash);

    const { items: notifications } = await notificationService.listNotifications(invitee.id, {
      skip: 0,
      take: 20,
      unreadOnly: false,
    });
    expect(notifications).toHaveLength(1);
    expect(notifications[0].type).toBe('INVITATION');
    expect(notifications[0].invitationId).toBe(invitation.id);
  });

  test('inviting an email with no WorkSync account creates no notification', async () => {
    const { owner, workspace } = await seedWorkspaceWithOwner();

    const { invitation } = await invitationService.createInvitation(owner.id, workspace.id, {
      email: 'nobody-yet@worksync.test',
      role: 'MEMBER',
    });

    // No user row exists for that email, so there is nothing to attach a
    // notification to — assert specifically that nothing references this
    // invitation (the store itself isn't empty across the whole file,
    // since earlier tests in this suite create their own notifications).
    const linked = prisma.notification._store.filter((n) => n.invitationId === invitation.id);
    expect(linked).toHaveLength(0);
  });

  test('accepting by invitation ID creates workspace membership and notifies the inviter', async () => {
    const { owner, workspace } = await seedWorkspaceWithOwner();
    const invitee = await prisma.user.create({
      data: { name: 'Ivy Invitee', email: 'ivy2@worksync.test', passwordHash: 'x' },
    });

    const { invitation } = await invitationService.createInvitation(owner.id, workspace.id, {
      email: invitee.email,
      role: 'ADMIN',
    });

    const fetched = await invitationService.getInvitationById(invitee.email, invitation.id);
    expect(fetched.status).toBe('INVITED');
    expect(fetched.workspace.name).toBe('MarvinsStack');

    const result = await invitationService.acceptInvitationById(invitee.id, invitee.email, invitation.id);
    expect(result.membership.role).toBe('ADMIN');
    expect(result.membership.userId).toBe(invitee.id);

    const membership = await authorizationService.getWorkspaceMembership(invitee.id, workspace.id);
    expect(membership).toBeTruthy();
    expect(membership.role).toBe('ADMIN');

    const updatedInvitation = await prisma.invitation.findUnique({ where: { id: invitation.id } });
    expect(updatedInvitation.status).toBe('ACCEPTED');

    // The inviter gets an "accepted" notification.
    const { items: ownerNotifications } = await notificationService.listNotifications(owner.id, {
      skip: 0,
      take: 20,
      unreadOnly: false,
    });
    expect(ownerNotifications.some((n) => n.title === 'Invitation accepted')).toBe(true);
  });

  test('accepting the same invitation twice is rejected, not silently re-applied', async () => {
    const { owner, workspace } = await seedWorkspaceWithOwner();
    const invitee = await prisma.user.create({
      data: { name: 'Ivy Invitee', email: 'ivy3@worksync.test', passwordHash: 'x' },
    });
    const { invitation } = await invitationService.createInvitation(owner.id, workspace.id, {
      email: invitee.email,
      role: 'MEMBER',
    });

    await invitationService.acceptInvitationById(invitee.id, invitee.email, invitation.id);

    await expect(
      invitationService.acceptInvitationById(invitee.id, invitee.email, invitation.id)
    ).rejects.toMatchObject({ code: 'INVITATION_NOT_ACCEPTABLE' });
  });

  test('a user cannot view or accept an invitation addressed to someone else', async () => {
    const { owner, workspace } = await seedWorkspaceWithOwner();
    const invitee = await prisma.user.create({
      data: { name: 'Ivy Invitee', email: 'ivy4@worksync.test', passwordHash: 'x' },
    });
    const bystander = await prisma.user.create({
      data: { name: 'Bob Bystander', email: 'bob@worksync.test', passwordHash: 'x' },
    });
    const { invitation } = await invitationService.createInvitation(owner.id, workspace.id, {
      email: invitee.email,
      role: 'MEMBER',
    });

    await expect(invitationService.getInvitationById(bystander.email, invitation.id)).rejects.toMatchObject({
      code: 'INVITATION_NOT_FOUND',
    });
    await expect(
      invitationService.acceptInvitationById(bystander.id, bystander.email, invitation.id)
    ).rejects.toMatchObject({ code: 'INVITATION_NOT_FOUND' });
  });

  test('cannot invite someone who is already a workspace member', async () => {
    const { owner, workspace } = await seedWorkspaceWithOwner();
    const alreadyMember = await prisma.user.create({
      data: { name: 'Already Member', email: 'already@worksync.test', passwordHash: 'x' },
    });
    await prisma.workspaceMember.create({
      data: { workspaceId: workspace.id, userId: alreadyMember.id, role: 'MEMBER' },
    });

    await expect(
      invitationService.createInvitation(owner.id, workspace.id, { email: alreadyMember.email, role: 'MEMBER' })
    ).rejects.toMatchObject({ code: 'ALREADY_MEMBER' });
  });
});
