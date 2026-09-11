import { PrismaClient } from '@prisma/client';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error('TEST_DATABASE_URL is required for PostgreSQL queue integration tests.');
}

const databaseName = new globalThis.URL(testDatabaseUrl).pathname.replace(/^\//, '').toLowerCase();
if (!/(^|[_-])test$/.test(databaseName)) {
  throw new Error('TEST_DATABASE_URL must point to a database whose name ends in "test".');
}

process.env.DATABASE_URL = testDatabaseUrl;

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl } } });
const keyPrefix = `queue-race-${Date.now()}-${Math.random().toString(16).slice(2)}`;
let jobQueue;

beforeAll(async () => {
  ({ jobQueue } = await import('../src/jobs/queue.js'));
});

afterEach(async () => {
  await prisma.job.deleteMany({ where: { idempotencyKey: { startsWith: keyPrefix } } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('PostgreSQL durable queue integration', () => {
  test('concurrent producers create only one job for an idempotency key', async () => {
    const key = `${keyPrefix}:idempotent`;
    const results = await Promise.all([
      jobQueue.enqueue({ type: 'POSTGRES_TEST', payload: { resourceId: 'one' }, idempotencyKey: key }),
      jobQueue.enqueue({ type: 'POSTGRES_TEST', payload: { resourceId: 'one' }, idempotencyKey: key }),
    ]);
    const created = results.filter(Boolean);
    expect(created).toHaveLength(1);
    expect(await prisma.job.count({ where: { idempotencyKey: key } })).toBe(1);
  });

  test('concurrent workers claim distinct pending jobs with PostgreSQL locking', async () => {
    const first = await jobQueue.enqueue({
      type: 'POSTGRES_TEST', payload: { resourceId: 'first' }, idempotencyKey: `${keyPrefix}:first`,
    });
    const second = await jobQueue.enqueue({
      type: 'POSTGRES_TEST', payload: { resourceId: 'second' }, idempotencyKey: `${keyPrefix}:second`,
    });
    const claims = await Promise.all([jobQueue.getPendingJob(), jobQueue.getPendingJob()]);
    expect(claims).toHaveLength(2);
    expect(new Set(claims.map((job) => job?.id))).toEqual(new Set([first.id, second.id]));
    expect(claims.every((job) => job.status === 'PROCESSING')).toBe(true);
  });
});
