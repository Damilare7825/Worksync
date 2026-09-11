import { jest } from '@jest/globals';
import { createFakePrisma } from './helpers/fakePrisma.js';
import { hashPassword } from '../src/utils/password.js';
import { generateResetToken } from '../src/utils/token.js';

let prisma;
let authService;

beforeAll(async () => {
  prisma = createFakePrisma();
  jest.unstable_mockModule('../src/config/database.js', () => ({
    prisma,
    connectDatabase: async () => {},
    disconnectDatabase: async () => {},
  }));

  authService = await import('../src/services/auth.service.js');
});

const PASSWORD = 'Password123!';
const BASE_USER = {
  id: 'user-session-1',
  email: 'session@worksync.test',
  passwordHash: await hashPassword(PASSWORD),
};

beforeEach(async () => {
  prisma._resetAll();
  await prisma.user.create({
    data: { ...BASE_USER, name: 'Session Tester' },
  });
});

describe('Session & JWT Security', () => {
  test('login creates a session with refresh token hash', async () => {
    const result = await authService.loginUser({
      email: BASE_USER.email,
      password: 'Password123!',
    });

    expect(result.token).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(result.refreshToken).toHaveLength(64);

    const session = await prisma.session.findFirst({
      where: { userId: BASE_USER.id },
    });
    expect(session).toBeDefined();
    expect(session.refreshTokenHash).toBeDefined();
    expect(session.refreshTokenHash).toHaveLength(64);
    expect(session.revokedAt).toBeUndefined();
  });

  test('register creates a session with refresh token hash', async () => {
    const result = await authService.registerUser({
      name: 'New User',
      email: 'new@worksync.test',
      password: 'Password123!',
    });

    expect(result.token).toBeDefined();
    expect(result.refreshToken).toBeDefined();

    const session = await prisma.session.findFirst({
      where: { userId: result.user.id },
    });
    expect(session.refreshTokenHash).toBeDefined();
  });

  test('refresh succeeds with valid refresh token and rotates it', async () => {
    const login = await authService.loginUser({
      email: BASE_USER.email,
      password: 'Password123!',
    });

    const oldHash = await prisma.session.findFirst({
      where: { userId: BASE_USER.id },
    }).then((s) => s.refreshTokenHash);

    const refreshed = await authService.refreshAccessToken(login.refreshToken);

    expect(refreshed.token).toBeDefined();
    expect(refreshed.refreshToken).toBeDefined();
    expect(refreshed.refreshToken).not.toBe(login.refreshToken);

    const session = await prisma.session.findFirst({
      where: { userId: BASE_USER.id },
    });
    expect(session.refreshTokenHash).not.toBe(oldHash);
  });

  test('old refresh token reuse fails after rotation', async () => {
    const login = await authService.loginUser({
      email: BASE_USER.email,
      password: 'Password123!',
    });

    await authService.refreshAccessToken(login.refreshToken);

    await expect(authService.refreshAccessToken(login.refreshToken)).rejects.toThrow('Invalid or expired refresh token');
  });

  test('concurrent refresh requests cannot both succeed', async () => {
    const login = await authService.loginUser({
      email: BASE_USER.email,
      password: 'Password123!',
    });

    const [r1, r2] = await Promise.allSettled([
      authService.refreshAccessToken(login.refreshToken),
      authService.refreshAccessToken(login.refreshToken),
    ]);

    const successes = [r1, r2].filter((r) => r.status === 'fulfilled');
    expect(successes).toHaveLength(1);
  });

  test('expired refresh token fails', async () => {
    const login = await authService.loginUser({
      email: BASE_USER.email,
      password: 'Password123!',
    });

    const session = await prisma.session.findFirst({
      where: { userId: BASE_USER.id },
    });
    await prisma.session.update({
      where: { id: session.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await expect(authService.refreshAccessToken(login.refreshToken)).rejects.toThrow('Invalid or expired refresh token');
  });

  test('revoked refresh token fails', async () => {
    const login = await authService.loginUser({
      email: BASE_USER.email,
      password: 'Password123!',
    });

    const session = await prisma.session.findFirst({
      where: { userId: BASE_USER.id },
    });
    await prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    await expect(authService.refreshAccessToken(login.refreshToken)).rejects.toThrow('Invalid or expired refresh token');
  });

  test('logout revokes the session', async () => {
    await authService.loginUser({
      email: BASE_USER.email,
      password: 'Password123!',
    });

    const sessionBefore = await prisma.session.findFirst({
      where: { userId: BASE_USER.id },
    });
    expect(sessionBefore).toBeDefined();

    await authService.logoutUser(BASE_USER.id, sessionBefore.id);

    const sessionAfter = await prisma.session.findUnique({
      where: { id: sessionBefore.id },
    });
    expect(sessionAfter).toBeNull();
  });

  test('password change invalidates sessions', async () => {
    await authService.loginUser({
      email: BASE_USER.email,
      password: 'Password123!',
    });

    const sessionsBefore = await prisma.session.findMany({
      where: { userId: BASE_USER.id },
    });
    expect(sessionsBefore.length).toBeGreaterThan(0);

    await authService.changePassword(BASE_USER.id, {
      currentPassword: 'Password123!',
      newPassword: 'NewPassword123!',
    });

    const sessionsAfter = await prisma.session.findMany({
      where: { userId: BASE_USER.id },
    });
    expect(sessionsAfter).toHaveLength(0);
  });

  test('password reset invalidates sessions', async () => {
    await authService.loginUser({
      email: BASE_USER.email,
      password: 'Password123!',
    });

    const sessionsBefore = await prisma.session.findMany({
      where: { userId: BASE_USER.id },
    });
    expect(sessionsBefore.length).toBeGreaterThan(0);

    // Create a reset token manually
    const { token, tokenHash } = generateResetToken();
    await prisma.user.update({
      where: { id: BASE_USER.id },
      data: {
        resetPasswordTokenHash: tokenHash,
        resetPasswordExpiresAt: new Date(Date.now() + 3600000),
      },
    });

    await authService.resetPassword({ token, password: 'NewPassword123!' });

    const sessionsAfter = await prisma.session.findMany({
      where: { userId: BASE_USER.id },
    });
    expect(sessionsAfter).toHaveLength(0);
  });

  test('multiple devices create separate sessions', async () => {
    const s1 = await authService.loginUser({
      email: BASE_USER.email,
      password: 'Password123!',
    });
    const s2 = await authService.loginUser({
      email: BASE_USER.email,
      password: 'Password123!',
    });

    expect(s1.refreshToken).not.toBe(s2.refreshToken);

    const sessions = await prisma.session.findMany({
      where: { userId: BASE_USER.id },
    });
    expect(sessions).toHaveLength(2);
  });
});
