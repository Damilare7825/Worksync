import { jest } from '@jest/globals';

// Regression test for a real bug found while wiring up the frontend
// ResetPassword page: requestPasswordReset used to call
// sendPasswordResetEmail(user.email, token) with the *raw token*, while
// every other email link in the codebase (invitation, workspace join)
// builds a full `${clientUrl}/path/${token}` URL. A person clicking the
// emailed link would have landed on a bare token string, not a working
// reset page.

let authService;
let sendPasswordResetEmail;
let prismaMock;

beforeAll(async () => {
  prismaMock = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  sendPasswordResetEmail = jest.fn().mockResolvedValue({ success: true });

  jest.unstable_mockModule('../src/config/database.js', () => ({ prisma: prismaMock }));
  jest.unstable_mockModule('../src/config/env.js', () => ({
    env: { clientUrl: 'https://app.worksync.test' },
  }));
  jest.unstable_mockModule('../src/services/email/index.js', () => ({
    sendPasswordResetEmail,
    sendWorkspaceInvitationEmail: jest.fn(),
    sendWelcomeEmail: jest.fn(),
  }));

  authService = await import('../src/services/auth.service.js');
});

describe('requestPasswordReset', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('emails a real clickable reset URL, not the bare token', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'ada@example.test' });

    await authService.requestPasswordReset('ada@example.test');

    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    const [toEmail, resetUrl] = sendPasswordResetEmail.mock.calls[0];
    expect(toEmail).toBe('ada@example.test');
    expect(resetUrl).toMatch(/^https:\/\/app\.worksync\.test\/reset-password\?token=.+/);
  });

  test('does not send an email for an unknown address, but still returns the generic message', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const result = await authService.requestPasswordReset('nobody@example.test');

    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    expect(result.message).toMatch(/if an account exists/i);
  });
});
