import { jest } from '@jest/globals';
import { createFakePrisma } from './helpers/fakePrisma.js';

let prisma;
let jobQueue;
let runJobWorkerCycle;

beforeAll(async () => {
  prisma = createFakePrisma();
  jest.unstable_mockModule('../src/config/database.js', () => ({
    prisma,
    connectDatabase: async () => {},
    disconnectDatabase: async () => {},
  }));

  const queueModule = await import('../src/jobs/queue.js');
  jobQueue = queueModule.jobQueue;
  ({ runJobWorkerCycle } = await import('../src/jobs/worker.js'));
});

beforeEach(async () => {
  prisma._resetAll();
});

describe('Job Queue', () => {
  test('enqueue persists a job', async () => {
    const job = await jobQueue.enqueue({ type: 'TEST', payload: { foo: 'bar' } });
    expect(job).toBeDefined();
    expect(job.id).toBeDefined();
    expect(job.status).toBe('PENDING');

    const stored = await prisma.job.findUnique({ where: { id: job.id } });
    expect(stored).toBeDefined();
    expect(stored.type).toBe('TEST');
  });

  test('idempotent enqueue skips duplicate', async () => {
    const key = 'TEST:idempotent';
    const j1 = await jobQueue.enqueue({ type: 'TEST', payload: { foo: 'bar' }, idempotencyKey: key });
    const j2 = await jobQueue.enqueue({ type: 'TEST', payload: { foo: 'bar' }, idempotencyKey: key });
    expect(j1).toBeDefined();
    expect(j2).toBeNull();
  });

  test('rejects unsafe or oversized job payloads before persistence', async () => {
    await expect(
      jobQueue.enqueue({ type: 'TEST', payload: { refreshToken: 'must-not-persist' } })
    ).rejects.toThrow(/must not contain secrets/i);
    await expect(
      jobQueue.enqueue({ type: 'TEST', payload: { content: 'x'.repeat(64 * 1024 + 1) } })
    ).rejects.toThrow(/no larger/i);
    await expect(
      jobQueue.enqueue({
        type: 'EMAIL_DELIVERY',
        payload: { to: 'user@example.test', template: 'PASSWORD_RESET', data: { resetUrl: 'https://example.test/reset/raw-secret' } },
      })
    ).rejects.toThrow(/must not be queued/i);
    await expect(jobQueue.enqueue({ type: 'TEST', payload: 'not-an-object' }))
      .rejects.toThrow(/JSON object/i);
    expect(prisma.job._store).toHaveLength(0);
  });

  test('getPendingJob claims one job atomically', async () => {
    await jobQueue.enqueue({ type: 'TEST', payload: { foo: '1' } });
    await jobQueue.enqueue({ type: 'TEST', payload: { foo: '2' } });

    const job = await jobQueue.getPendingJob();
    expect(job).toBeDefined();
    expect(job.status).toBe('PROCESSING');

    const next = await jobQueue.getPendingJob();
    expect(next).not.toBeNull();
    expect(next.status).toBe('PROCESSING');
    expect(next.id).not.toBe(job.id);
  });

  test('processJob marks success', async () => {
    const handler = jest.fn();
    jobQueue.registerProcessor('TEST_SUCCESS', handler);

    await jobQueue.enqueue({ type: 'TEST_SUCCESS', payload: { foo: 'bar' } });
    const job = await jobQueue.getPendingJob();
    await jobQueue.processJob(job);

    const stored = await prisma.job.findUnique({ where: { id: job.id } });
    expect(stored.status).toBe('COMPLETED');
    expect(handler).toHaveBeenCalledWith({ foo: 'bar' });
  });

  test('unknown job types become visible permanent failures', async () => {
    await jobQueue.enqueue({ type: 'UNKNOWN_PROCESSOR', payload: {} });
    const job = await jobQueue.getPendingJob();
    await jobQueue.processJob(job);
    const stored = await prisma.job.findUnique({ where: { id: job.id } });
    expect(stored.status).toBe('FAILED');
    expect(stored.error).toMatch(/No processor registered/);
  });

  test('does not retry errors explicitly classified as permanent', async () => {
    jobQueue.registerProcessor('PERMANENT_FAILURE', async () => {
      const error = new Error('invalid payload');
      error.retryable = false;
      throw error;
    });
    await jobQueue.enqueue({ type: 'PERMANENT_FAILURE', payload: {}, maxAttempts: 3 });
    await jobQueue.processJob(await jobQueue.getPendingJob());
    expect(prisma.job._store[0]).toMatchObject({
      status: 'FAILED', attempts: 1, error: 'PROCESSING_ERROR',
    });
  });

  test('processJob retries with backoff on failure', async () => {
    let calls = 0;
    jobQueue.registerProcessor('TEST_FAIL', async () => {
      calls++;
      if (calls < 2) throw new Error('transient');
    });

    await jobQueue.enqueue({ type: 'TEST_FAIL', payload: {}, maxAttempts: 3 });
    const job = await jobQueue.getPendingJob();
    await jobQueue.processJob(job);

    let stored = await prisma.job.findUnique({ where: { id: job.id } });
    expect(stored.status).toBe('PENDING');
    expect(stored.attempts).toBe(1);
    expect(stored.nextAttemptAt).not.toBeNull();

    // Simulate time passing
    stored.nextAttemptAt = new Date(Date.now() - 100);
    await prisma.job.update({ where: { id: job.id }, data: stored });

    const job2 = await jobQueue.getPendingJob();
    await jobQueue.processJob(job2);

    stored = await prisma.job.findUnique({ where: { id: job.id } });
    expect(stored.status).toBe('COMPLETED');
    expect(calls).toBe(2);
  });

  test('processJob fails after max attempts', async () => {
    jobQueue.registerProcessor('TEST_MAX', async () => {
      throw new Error('permanent');
    });

    await jobQueue.enqueue({ type: 'TEST_MAX', payload: {}, maxAttempts: 2 });
    const job = await jobQueue.getPendingJob();
    await jobQueue.processJob(job);

    // Simulate backoff elapsed so the job is eligible for re-processing
    await prisma.job.update({
      where: { id: job.id },
      data: { nextAttemptAt: new Date(Date.now() - 1000) },
    });

    const job2 = await jobQueue.getPendingJob();
    expect(job2).not.toBeNull();
    await jobQueue.processJob(job2);

    const stored = await prisma.job.findUnique({ where: { id: job.id } });
    expect(stored.status).toBe('FAILED');
    expect(stored.attempts).toBe(2);
  });

  test('recoverStaleJobs requeues stale processing jobs', async () => {
    const job = await jobQueue.enqueue({ type: 'TEST_STALE', payload: {} });
    await jobQueue.getPendingJob();

    // Simulate stale by backdating updatedAt
    await prisma.job.update({
      where: { id: job.id },
      data: { updatedAt: new Date(Date.now() - 6 * 60 * 1000) },
    });

    const recovered = await jobQueue.recoverStaleJobs();
    expect(recovered).toBe(1);

    const stored = await prisma.job.findUnique({ where: { id: job.id } });
    expect(stored.status).toBe('PENDING');
    expect(stored.nextAttemptAt).not.toBeNull();
  });

  test('recoverStaleJobs fails stale jobs beyond max attempts', async () => {
    const job = await jobQueue.enqueue({ type: 'TEST_STALE_MAX', payload: {}, maxAttempts: 1 });
    await jobQueue.getPendingJob();
    await prisma.job.update({
      where: { id: job.id },
      data: { attempts: 1, updatedAt: new Date(Date.now() - 6 * 60 * 1000) },
    });

    const recovered = await jobQueue.recoverStaleJobs();
    expect(recovered).toBe(1);

    const stored = await prisma.job.findUnique({ where: { id: job.id } });
    expect(stored.status).toBe('FAILED');
  });

  test('getStats returns counts', async () => {
    await jobQueue.enqueue({ type: 'S1', payload: {} });
    await jobQueue.enqueue({ type: 'S2', payload: {} });

    const stats = await jobQueue.getStats();
    expect(stats.pending).toBe(2);
    expect(stats.processing).toBe(0);
    expect(stats.completed).toBe(0);
    expect(stats.failed).toBe(0);
  });

  test('worker cycles are single-flight and do not claim a second job while one is running', async () => {
    let release;
    const started = new Promise((resolve) => {
      release = resolve;
    });
    let calls = 0;
    jobQueue.registerProcessor('SLOW_TEST', async () => {
      calls += 1;
      await started;
    });
    await jobQueue.enqueue({ type: 'SLOW_TEST', payload: {} });
    await jobQueue.enqueue({ type: 'SLOW_TEST', payload: { sequence: 2 } });

    const firstCycle = runJobWorkerCycle();
    const secondCycle = await runJobWorkerCycle();
    expect(secondCycle).toBe(false);
    release();
    expect(await firstCycle).toBe(true);
    expect(calls).toBe(1);

    const stats = await jobQueue.getStats();
    expect(stats.completed).toBe(1);
    expect(stats.pending).toBe(1);
  });

  test('cleanup removes completed and failed jobs after the retention period', async () => {
    const completed = await jobQueue.enqueue({ type: 'CLEANUP_COMPLETED', payload: {} });
    const failed = await jobQueue.enqueue({ type: 'CLEANUP_FAILED', payload: {} });
    const old = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    await prisma.job.update({ where: { id: completed.id }, data: { status: 'COMPLETED', processedAt: old } });
    await prisma.job.update({ where: { id: failed.id }, data: { status: 'FAILED', failedAt: old } });

    expect(await jobQueue.cleanupCompletedJobs()).toBe(2);
    expect(prisma.job._store).toHaveLength(0);
  });
});
