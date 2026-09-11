import { jest } from '@jest/globals';
import { createFakePrisma } from './helpers/fakePrisma.js';

let prisma;
let invitationService;
let _authorizationService;
let workspaceService;

beforeAll(async () => {
    prisma = createFakePrisma();
    jest.unstable_mockModule('../src/config/database.js', () => ({
        prisma,
        connectDatabase: async () => { },
        disconnectDatabase: async () => { },
    }));

    invitationService = await import('../src/services/invitation.service.js');
    _authorizationService = await import('../src/services/authorization.service.js');
    workspaceService = await import('../src/services/workspace.service.js');
});

async function seedWorkspaceWithOwner() {
    const owner = await prisma.user.create({
        data: { name: 'Owner Olu', email: 'owner@security.test', passwordHash: 'x' },
    });
    const workspace = await prisma.workspace.create({ data: { name: 'SecureWorkspace', createdBy: owner.id } });
    await prisma.workspaceMember.create({ data: { workspaceId: workspace.id, userId: owner.id, role: 'OWNER' } });
    return { owner, workspace };
}

describe('Security: Invitation Decline Ownership', () => {
    test('declining an invitation requires the user to be authenticated', async () => {
        const { owner, workspace } = await seedWorkspaceWithOwner();
        const invitee = await prisma.user.create({
            data: { name: 'Invitee User', email: 'invitee@security.test', passwordHash: 'x' },
        });

        const { inviteUrl } = await invitationService.createInvitation(owner.id, workspace.id, {
            email: invitee.email,
            role: 'MEMBER',
        });
        const rawToken = inviteUrl.split('/invitations/')[1];

        // Test: decline without proper authentication should fail
        // The controller layer adds authentication, but the service signature requires userId/userEmail
        await expect(
            invitationService.declineInvitation(null, null, rawToken)
        ).rejects.toThrow();
    });

    test('declining an invitation must match the invited email address', async () => {
        const { owner, workspace } = await seedWorkspaceWithOwner();
        const invitee = await prisma.user.create({
            data: { name: 'Real Invitee', email: 'real@security.test', passwordHash: 'x' },
        });
        const attacker = await prisma.user.create({
            data: { name: 'Attacker User', email: 'attacker@security.test', passwordHash: 'x' },
        });

        const { inviteUrl } = await invitationService.createInvitation(owner.id, workspace.id, {
            email: invitee.email,
            role: 'MEMBER',
        });
        const rawToken = inviteUrl.split('/invitations/')[1];

        // Test: attacker tries to decline someone else's invitation
        await expect(
            invitationService.declineInvitation(attacker.id, attacker.email, rawToken)
        ).rejects.toMatchObject({
            code: 'INVITATION_EMAIL_MISMATCH',
        });

        // Test: the real invitee CAN decline their own
        const decline = await invitationService.declineInvitation(invitee.id, invitee.email, rawToken);
        expect(decline).toBeUndefined(); // successful decline returns nothing
    });

    test('declining after already declining is rejected', async () => {
        const { owner, workspace } = await seedWorkspaceWithOwner();
        const invitee = await prisma.user.create({
            data: { name: 'User Invitee', email: 'declined@security.test', passwordHash: 'x' },
        });

        const { inviteUrl } = await invitationService.createInvitation(owner.id, workspace.id, {
            email: invitee.email,
            role: 'MEMBER',
        });
        const rawToken = inviteUrl.split('/invitations/')[1];

        // First decline succeeds
        await invitationService.declineInvitation(invitee.id, invitee.email, rawToken);

        // Second decline should fail (invitation is already DECLINED)
        await expect(
            invitationService.declineInvitation(invitee.id, invitee.email, rawToken)
        ).rejects.toMatchObject({
            code: 'INVITATION_NOT_ACTIONABLE',
        });
    });
});

describe('Security: Invite-Link Token Storage', () => {
    test('workspace invite-link tokens are stored as hashes, not raw secrets', async () => {
        const { owner, workspace } = await seedWorkspaceWithOwner();

        const { inviteUrl } = await workspaceService.enableInviteLink(owner.id, workspace.id, { role: 'ADMIN' });
        const rawToken = inviteUrl.split('/join/')[1];
        const stored = await prisma.workspace.findUnique({ where: { id: workspace.id } });

        // The raw token should never be stored in the database
        expect(stored.inviteLinkToken).not.toBe(rawToken);

        // The stored value should be a hash (SHA-256 hex string, 64 chars)
        expect(stored.inviteLinkToken).toMatch(/^[a-f0-9]{64}$/);
    });

    test('invite-link lookup hashes the raw token before database query', async () => {
        const { owner, workspace } = await seedWorkspaceWithOwner();

        const { inviteUrl } = await workspaceService.enableInviteLink(owner.id, workspace.id, { role: 'MEMBER' });
        const rawToken = inviteUrl.split('/join/')[1];

        // This should succeed — the service hashes the raw token before lookup
        const result = await workspaceService.getWorkspaceByInviteLinkToken(rawToken);
        expect(result.id).toBe(workspace.id);
        expect(result.name).toBe('SecureWorkspace');
    });

    test('regenerating invite-link creates a new token and invalidates old ones', async () => {
        const { owner, workspace } = await seedWorkspaceWithOwner();

        const { inviteUrl: url1 } = await workspaceService.enableInviteLink(owner.id, workspace.id, { role: 'MEMBER' });
        const token1 = url1.split('/join/')[1];

        const { inviteUrl: url2 } = await workspaceService.regenerateInviteLink(owner.id, workspace.id);
        const token2 = url2.split('/join/')[1];

        // Tokens should be different
        expect(token1).not.toBe(token2);

        // Old token should no longer work
        await expect(workspaceService.getWorkspaceByInviteLinkToken(token1)).rejects.toMatchObject({
            code: 'INVITE_LINK_NOT_FOUND',
        });

        // New token should work
        const result = await workspaceService.getWorkspaceByInviteLinkToken(token2);
        expect(result.id).toBe(workspace.id);
    });

    test('disabling then re-enabling invite-link generates a new token', async () => {
        const { owner, workspace } = await seedWorkspaceWithOwner();

        const { inviteUrl: url1 } = await workspaceService.enableInviteLink(owner.id, workspace.id, { role: 'MEMBER' });
        const token1 = url1.split('/join/')[1];

        await workspaceService.disableInviteLink(owner.id, workspace.id);

        const { inviteUrl: url2 } = await workspaceService.enableInviteLink(owner.id, workspace.id, { role: 'MEMBER' });
        const token2 = url2.split('/join/')[1];

        // Tokens should be different for security
        expect(token1).not.toBe(token2);

        // Old token should not work
        await expect(workspaceService.getWorkspaceByInviteLinkToken(token1)).rejects.toMatchObject({
            code: 'INVITE_LINK_NOT_FOUND',
        });

        // New token should work
        const result = await workspaceService.getWorkspaceByInviteLinkToken(token2);
        expect(result.id).toBe(workspace.id);
    });
});
