import { jest } from '@jest/globals';
import request from 'supertest';
import { createFakePrisma } from './helpers/fakePrisma.js';
import { hashPassword } from '../src/utils/password.js';
import { generateResetToken } from '../src/utils/token.js';

let prisma;
let authService;
let authorizationService;
let taskService;
let createApp;

beforeAll(async () => {
  prisma = createFakePrisma();
  jest.unstable_mockModule('../src/config/database.js', () => ({
    prisma,
    connectDatabase: async () => {},
    disconnectDatabase: async () => {},
  }));

  authService = await import('../src/services/auth.service.js');
  authorizationService = await import('../src/services/authorization.service.js');
  taskService = await import('../src/services/task.service.js');
  const appModule = await import('../src/app.js');
  createApp = appModule.createApp;
});

const TEST_PASSWORD = 'SecurePassword123!';
const TEST_USER = {
  id: 'user-sec-lockout-1',
  email: 'lockout@worksync.test',
  name: 'Lockout Target',
};

beforeEach(async () => {
  prisma._resetAll();
  const passwordHash = await hashPassword(TEST_PASSWORD);
  await prisma.user.create({
    data: {
      ...TEST_USER,
      passwordHash,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });
});

describe('Phase 22 — Security Hardening Test Suite', () => {
  describe('Account Lockout Protection', () => {
    test('4 failed attempts do not lock the account', async () => {
      for (let i = 1; i <= 4; i++) {
        await expect(
          authService.loginUser({ email: TEST_USER.email, password: 'WrongPassword!' })
        ).rejects.toMatchObject({
          code: 'INVALID_CREDENTIALS',
        });

        const user = await prisma.user.findUnique({ where: { id: TEST_USER.id } });
        expect(user.failedLoginAttempts).toBe(i);
        expect(user.lockedUntil).toBeNull();
      }
    });

    test('5th consecutive failed attempt locks the account with ACCOUNT_LOCKED', async () => {
      for (let i = 1; i <= 4; i++) {
        await expect(
          authService.loginUser({ email: TEST_USER.email, password: 'WrongPassword!' })
        ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
      }

      // 5th attempt triggers lockout
      await expect(
        authService.loginUser({ email: TEST_USER.email, password: 'WrongPassword!' })
      ).rejects.toMatchObject({
        code: 'ACCOUNT_LOCKED',
      });

      const user = await prisma.user.findUnique({ where: { id: TEST_USER.id } });
      expect(user.failedLoginAttempts).toBe(5);
      expect(user.lockedUntil).toBeInstanceOf(Date);
      expect(user.lockedUntil.getTime()).toBeGreaterThan(Date.now());
    });

    test('locked account rejects login even with correct password during lockout window', async () => {
      // Lock account
      await prisma.user.update({
        where: { id: TEST_USER.id },
        data: {
          failedLoginAttempts: 5,
          lockedUntil: new Date(Date.now() + 15 * 60 * 1000),
        },
      });

      // Attempt login with CORRECT password
      await expect(
        authService.loginUser({ email: TEST_USER.email, password: TEST_PASSWORD })
      ).rejects.toMatchObject({
        code: 'ACCOUNT_LOCKED',
      });
    });

    test('successful login resets failed login attempts counter', async () => {
      // 3 failed attempts
      for (let i = 1; i <= 3; i++) {
        await expect(
          authService.loginUser({ email: TEST_USER.email, password: 'WrongPassword!' })
        ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
      }

      let user = await prisma.user.findUnique({ where: { id: TEST_USER.id } });
      expect(user.failedLoginAttempts).toBe(3);

      // Successful login
      const result = await authService.loginUser({
        email: TEST_USER.email,
        password: TEST_PASSWORD,
      });
      expect(result.token).toBeDefined();

      user = await prisma.user.findUnique({ where: { id: TEST_USER.id } });
      expect(user.failedLoginAttempts).toBe(0);
      expect(user.lockedUntil).toBeNull();
    });

    test('expired lockout allows successful login and resets lock', async () => {
      // Set lock in the past
      await prisma.user.update({
        where: { id: TEST_USER.id },
        data: {
          failedLoginAttempts: 5,
          lockedUntil: new Date(Date.now() - 60 * 1000), // 1 min ago
        },
      });

      const result = await authService.loginUser({
        email: TEST_USER.email,
        password: TEST_PASSWORD,
      });
      expect(result.token).toBeDefined();

      const user = await prisma.user.findUnique({ where: { id: TEST_USER.id } });
      expect(user.failedLoginAttempts).toBe(0);
      expect(user.lockedUntil).toBeNull();
    });

    test('resetting password clears account lockout immediately', async () => {
      const { token, tokenHash } = generateResetToken();
      await prisma.user.update({
        where: { id: TEST_USER.id },
        data: {
          failedLoginAttempts: 5,
          lockedUntil: new Date(Date.now() + 15 * 60 * 1000),
          resetPasswordTokenHash: tokenHash,
          resetPasswordExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      const NEW_PASSWORD = 'NewSecurePassword123!';
      await authService.resetPassword({
        token,
        password: NEW_PASSWORD,
      });

      const user = await prisma.user.findUnique({ where: { id: TEST_USER.id } });
      expect(user.failedLoginAttempts).toBe(0);
      expect(user.lockedUntil).toBeNull();

      // Immediate login with new password succeeds
      const result = await authService.loginUser({
        email: TEST_USER.email,
        password: NEW_PASSWORD,
      });
      expect(result.token).toBeDefined();
    });
  });

  describe('Content Security Policy & Security Headers', () => {
    test('HTTP responses include Content-Security-Policy with strict directives', async () => {
      const app = createApp();
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.headers['content-security-policy']).toBeDefined();
      const csp = res.headers['content-security-policy'];
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'self'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("frame-ancestors 'none'");
    });

    test('HTTP responses include X-Frame-Options DENY', async () => {
      const app = createApp();
      const res = await request(app).get('/health');

      expect(res.headers['x-frame-options']).toBe('DENY');
    });

    test('HTTP responses include X-Content-Type-Options nosniff', async () => {
      const app = createApp();
      const res = await request(app).get('/health');

      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    test('HTTP responses include Referrer-Policy strict-origin-when-cross-origin', async () => {
      const app = createApp();
      const res = await request(app).get('/health');

      expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });
  });

  describe('Specialized Rate Limiting Headers', () => {
    test('forgot-password route enforces rate limit headers', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'test@example.com' });

      // Check standard RateLimit headers (express-rate-limit standardHeaders: true)
      expect(res.headers['ratelimit-limit'] || res.headers['x-ratelimit-limit']).toBeDefined();
    });
  });

  describe('Multi-Tenant Cross-Workspace Isolation & IDOR Protection', () => {
    test('user in Workspace A cannot access Workspace B project or tasks', async () => {
      const userA = await prisma.user.create({
        data: { name: 'User A', email: 'userA@tenant1.test', passwordHash: 'x' },
      });
      const userB = await prisma.user.create({
        data: { name: 'User B', email: 'userB@tenant2.test', passwordHash: 'x' },
      });

      const wsA = await prisma.workspace.create({
        data: { name: 'Tenant A Workspace', createdBy: userA.id },
      });
      await prisma.workspaceMember.create({
        data: { workspaceId: wsA.id, userId: userA.id, role: 'OWNER' },
      });

      const wsB = await prisma.workspace.create({
        data: { name: 'Tenant B Workspace', createdBy: userB.id },
      });
      await prisma.workspaceMember.create({
        data: { workspaceId: wsB.id, userId: userB.id, role: 'OWNER' },
      });

      const projectA = await prisma.project.create({
        data: { name: 'Secret Project A', workspaceId: wsA.id, createdBy: userA.id },
      });
      await prisma.projectMember.create({
        data: { projectId: projectA.id, userId: userA.id, role: 'MANAGER' },
      });

      const taskA = await prisma.task.create({
        data: {
          title: 'Classified Task A',
          projectId: projectA.id,
          workspaceId: wsA.id,
          createdBy: userA.id,
        },
      });

      // User B attempts to access Workspace A's resources (IDOR attempt)
      await expect(
        authorizationService.assertWorkspaceMembership(userB.id, wsA.id)
      ).rejects.toMatchObject({
        code: 'WORKSPACE_NOT_FOUND',
      });

      await expect(
        authorizationService.assertProjectAccess(userB.id, projectA.id)
      ).rejects.toMatchObject({
        code: 'PROJECT_NOT_FOUND',
      });

      await expect(
        taskService.getTask(userB.id, taskA.id)
      ).rejects.toMatchObject({
        code: 'PROJECT_NOT_FOUND',
      });
    });
  });
});
