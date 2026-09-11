import { PrismaClient } from '@prisma/client';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error('TEST_DATABASE_URL is required for the PostgreSQL refresh-race test.');
}

const databaseName = new globalThis.URL(testDatabaseUrl).pathname.replace(/^\//, '').toLowerCase();
if (!/(^|[_-])test$/.test(databaseName)) {
  throw new Error('TEST_DATABASE_URL must point to a database whose name ends in "test".');
}

process.env.DATABASE_URL = testDatabaseUrl;

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl } } });
const uniqueEmail = `refresh-race-${Date.now()}-${Math.random().toString(16).slice(2)}@worksync.test`;

let authService;
let userId;

beforeAll(async () => {
  const { hashPassword } = await import('../src/utils/password.js');
  authService = await import('../src/services/auth.service.js');
  const user = await prisma.user.create({
    data: { name: 'Refresh Race Test', email: uniqueEmail, passwordHash: await hashPassword('Password123!') },
  });
  userId = user.id;
});

afterAll(async () => {
  if (userId) {
    await prisma.session.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  }
  await prisma.$disconnect();
});

describe('PostgreSQL refresh-token concurrency', () => {
  beforeEach(async () => {
    await prisma.session.deleteMany({ where: { userId } });
  });

  test.each([2, 5, 10])('exactly one of %i simultaneous refreshes can rotate a credential', async (attempts) => {
    const login = await authService.loginUser({ email: uniqueEmail, password: 'Password123!' });
    const sessionBefore = await prisma.session.findFirst({ where: { userId } });
    const results = await Promise.allSettled(
      Array.from({ length: attempts }, () => authService.refreshAccessToken(login.refreshToken))
    );

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(attempts - 1);
    await expect(authService.refreshAccessToken(login.refreshToken)).rejects.toThrow('Invalid or expired refresh token');

    const sessions = await prisma.session.findMany({ where: { userId } });
    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe(sessionBefore.id);
    expect(sessions[0].refreshTokenHash).not.toBe(sessionBefore.refreshTokenHash);
  });
});
