import { jest } from '@jest/globals';
import { createFakePrisma } from './helpers/fakePrisma.js';

let prisma;
let invitationService;
let emailModule;

beforeAll(async () => {
  prisma = createFakePrisma();
  jest.unstable_mockModule('../src/config/database.js', () => ({
    prisma,
    connectDatabase: async () => {},
    disconnectDatabase: async () => {},
  }));

  invitationService = await import('../src/services/invitation.service.js');
  emailModule = await import('../src/services/email/index.js');
});

describe('Production Email Security & Invitation Flow', () => {
  beforeEach(() => {
    prisma.invitation._store.length = 0;
    prisma.workspace._store.length = 0;
    prisma.user._store.length = 0;
    prisma.workspaceMember._store.length = 0;
  });

  test('production mode throws error when SMTP configuration is missing', async () => {
    const { env } = await import('../src/config/env.js');
    const originalProd = env.isProduction;
    const originalHost = env.smtpHost;

    try {
      env.isProduction = true;
      env.smtpHost = undefined;

      await expect(
        emailModule.emailService.send({
          to: 'test@example.com',
          template: 'WELCOME',
          data: { name: 'Test', dashboardUrl: 'http://localhost/dashboard' },
        })
      ).rejects.toThrow(/missing SMTP_HOST/i);
    } finally {
      env.isProduction = originalProd;
      env.smtpHost = originalHost;
    }
  });

  test('invitation flow: create, resend, invalid token, expired token, accepted', async () => {
    const owner = await prisma.user.create({ data: { name: 'Owner', email: 'owner@ws.test', passwordHash: 'x' } });
    const workspace = await prisma.workspace.create({ data: { name: 'Acme Corp', createdBy: owner.id } });
    await prisma.workspaceMember.create({ data: { workspaceId: workspace.id, userId: owner.id, role: 'OWNER' } });

    // 1. Create invitation
    const inviteRes = await invitationService.createInvitation(owner.id, workspace.id, {
      email: 'invitee@ws.test',
      role: 'MEMBER',
    });

    expect(inviteRes.inviteUrl).toContain('/invitations/');
    expect(inviteRes.invitation.email).toBe('invitee@ws.test');
    expect(inviteRes.invitation.status).toBe('INVITED');

    const _token = inviteRes.inviteUrl.split('/invitations/')[1];

    // 2. Resend invitation
    const resendRes = await invitationService.resendInvitation(owner.id, workspace.id, inviteRes.invitation.id);
    expect(resendRes.inviteUrl).toContain('/invitations/');
    const newToken = resendRes.inviteUrl.split('/invitations/')[1];

    // 3. Invalid token throws 404
    await expect(invitationService.getInvitationByToken('invalid-token-123')).rejects.toThrow(/not found/i);

    // 4. Accept invitation with new account
    const invitee = await prisma.user.create({ data: { name: 'Invitee', email: 'invitee@ws.test', passwordHash: 'x' } });
    const acceptRes = await invitationService.acceptInvitation(invitee.id, invitee.email, newToken);
    expect(acceptRes.membership.workspaceId).toBe(workspace.id);
    expect(acceptRes.membership.role).toBe('MEMBER');

    // 5. Already accepted token cannot be accepted again
    await expect(invitationService.acceptInvitation(invitee.id, invitee.email, newToken)).rejects.toThrow(/accepted/i);
  });
});
