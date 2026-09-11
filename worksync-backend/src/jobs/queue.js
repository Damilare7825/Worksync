import crypto from 'crypto';
import { prisma } from '../config/database.js';
import { logger } from '../utils/logger.js';

export const JOB_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
};

const PROCESSING_TIMEOUT_MS = 5 * 60 * 1000;
const JOB_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_PAYLOAD_BYTES = 64 * 1024;
const SENSITIVE_PAYLOAD_KEY = /(?:password|token|secret|authorization|cookie|api[_-]?key)/i;
const SENSITIVE_EMAIL_TEMPLATES = new Set(['PASSWORD_RESET', 'WORKSPACE_INVITATION']);

function validateJobInput({ type, payload, maxAttempts, idempotencyKey }) {
  if (typeof type !== 'string' || !type.trim() || type.length > 100) {
    throw new TypeError('Job type must be a non-empty string of at most 100 characters');
  }
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10) {
    throw new RangeError('maxAttempts must be an integer between 1 and 10');
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new TypeError('Job payload must be a JSON object');
  }
  if (idempotencyKey !== undefined && (typeof idempotencyKey !== 'string' || !idempotencyKey || idempotencyKey.length > 255)) {
    throw new TypeError('idempotencyKey must be a non-empty string of at most 255 characters');
  }

  let serialized;
  try {
    serialized = JSON.stringify(payload);
  } catch {
    throw new TypeError('Job payload must be JSON serializable');
  }
  if (serialized === undefined || Buffer.byteLength(serialized, 'utf8') > MAX_PAYLOAD_BYTES) {
    throw new RangeError(`Job payload must be JSON serializable and no larger than ${MAX_PAYLOAD_BYTES} bytes`);
  }

  const containsSensitiveKey = (value) => {
    if (!value || typeof value !== 'object') return false;
    return Object.entries(value).some(([key, child]) => SENSITIVE_PAYLOAD_KEY.test(key) || containsSensitiveKey(child));
  };
  if (containsSensitiveKey(payload)) {
    throw new TypeError('Job payload must not contain secrets or authentication credentials');
  }
  if (type === 'EMAIL_DELIVERY' && SENSITIVE_EMAIL_TEMPLATES.has(payload.template)) {
    throw new TypeError('Security-sensitive email templates must not be queued with raw links');
  }
}

function computeBackoff(attempts) {
  const base = [1000, 5000, 30000];
  const delay = base[Math.min(attempts, base.length - 1)] || 30000;
  const jitter = Math.floor(Math.random() * 500);
  return new Date(Date.now() + delay + jitter);
}

class JobQueue {
  constructor() {
    this.processors = new Map();
  }

  registerProcessor(type, handler) {
    this.processors.set(type, handler);
  }

  async enqueue({ type, payload = {}, maxAttempts = 3, idempotencyKey }) {
    validateJobInput({ type, payload, maxAttempts, idempotencyKey });
    const key = idempotencyKey || `${type}:${JSON.stringify(payload)}`;
    const existing = await prisma.job.findUnique({ where: { idempotencyKey: key } });
    if (existing) {
      logger.info('[queue] Skipping duplicate idempotent job', { type });
      return null;
    }

    const id = crypto.randomUUID();
    try {
      await prisma.job.create({
        data: {
          id,
          type,
          payload,
          maxAttempts,
          idempotencyKey: key,
          status: JOB_STATUS.PENDING,
        },
      });
    } catch (error) {
      // The unique constraint is the final authority when concurrent
      // producers race after both checked for an existing key.
      if (error?.code === 'P2002') {
        logger.info('[queue] Skipping concurrently enqueued idempotent job', { type });
        return null;
      }
      throw error;
    }
    logger.info(`[queue] Job enqueued: ${id} (${type})`);
    return { id, type, status: JOB_STATUS.PENDING };
  }

  async recoverStaleJobs() {
    const cutoff = new Date(Date.now() - PROCESSING_TIMEOUT_MS);
    const stale = await prisma.job.findMany({
      where: {
        status: JOB_STATUS.PROCESSING,
        updatedAt: { lt: cutoff },
      },
    });

    for (const job of stale) {
      const attempts = job.attempts + 1;
      if (attempts >= job.maxAttempts) {
        await prisma.job.update({
          where: { id: job.id },
          data: { status: JOB_STATUS.FAILED, failedAt: new Date(), error: 'Stale job exceeded max attempts' },
        });
        logger.warn(`[queue] Stale job permanently failed: ${job.id}`);
      } else {
        await prisma.job.update({
          where: { id: job.id },
          data: { status: JOB_STATUS.PENDING, attempts, nextAttemptAt: computeBackoff(attempts) },
        });
        logger.warn(`[queue] Recovered stale job: ${job.id} (attempt ${attempts})`);
      }
    }

    return stale.length;
  }

  async getPendingJob() {
    return prisma.$transaction(async (tx) => {
      // PostgreSQL row locking is the authoritative multi-worker claim path.
      // Exercise it in test/staging too whenever the client supports raw SQL;
      // the in-memory test double intentionally falls back below.
      if (typeof tx.$queryRaw === 'function') {
        try {
          const claimed = await tx.$queryRaw`
            UPDATE "jobs"
            SET "status" = ${JOB_STATUS.PROCESSING}, "updatedAt" = NOW(), "nextAttemptAt" = NULL
            WHERE "id" = (
              SELECT "id" FROM "jobs"
              WHERE "status" = ${JOB_STATUS.PENDING}
                AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= NOW())
              ORDER BY "createdAt" ASC
              LIMIT 1
              FOR UPDATE SKIP LOCKED
            )
            RETURNING *;
          `;
          if (claimed && claimed.length > 0) {
            return claimed[0];
          }
          return null;
        } catch {
          // Fallback below
        }
      }

      const job = await tx.job.findFirst({
        where: {
          status: JOB_STATUS.PENDING,
          OR: [
            { nextAttemptAt: null },
            { nextAttemptAt: { lte: new Date() } },
          ],
        },
        orderBy: { createdAt: 'asc' },
      });
      if (!job) return null;

      const result = await tx.job.updateMany({
        where: { id: job.id, status: JOB_STATUS.PENDING },
        data: { status: JOB_STATUS.PROCESSING, nextAttemptAt: null },
      });

      if (result.count === 0) {
        return null;
      }

      return { ...job, status: JOB_STATUS.PROCESSING };
    });
  }

  async processJob(job) {
    const handler = this.processors.get(job.type);
    if (!handler) {
      await prisma.job.update({
        where: { id: job.id },
        data: { status: JOB_STATUS.FAILED, error: `No processor registered for job type: ${job.type}`, failedAt: new Date() },
      });
      logger.error(`[queue] No processor registered for job type: ${job.type}`, { jobId: job.id });
      return;
    }

    try {
      await handler(job.payload);
      await prisma.job.update({
        where: { id: job.id },
        data: { status: JOB_STATUS.COMPLETED, processedAt: new Date() },
      });
      logger.info(`[queue] Job completed: ${job.id} (${job.type})`);
    } catch (error) {
      const attempts = job.attempts + 1;
      if (error?.retryable !== false && attempts < job.maxAttempts) {
        const nextAttemptAt = computeBackoff(attempts);
        await prisma.job.update({
          where: { id: job.id },
          data: { status: JOB_STATUS.PENDING, attempts, nextAttemptAt },
        });
        logger.warn(`[queue] Job failed attempt ${attempts}/${job.maxAttempts}: ${job.id}`, { errorCode: 'PROCESSING_ERROR' });
      } else {
        await prisma.job.update({
          where: { id: job.id },
          data: { status: JOB_STATUS.FAILED, attempts, failedAt: new Date(), error: 'PROCESSING_ERROR' },
        });
        logger.error(`[queue] Job permanently failed: ${job.id}`, { errorCode: 'PROCESSING_ERROR' });
      }
    }
  }

  async getStats() {
    const [pending, processing, completed, failed] = await Promise.all([
      prisma.job.count({ where: { status: JOB_STATUS.PENDING } }),
      prisma.job.count({ where: { status: JOB_STATUS.PROCESSING } }),
      prisma.job.count({ where: { status: JOB_STATUS.COMPLETED } }),
      prisma.job.count({ where: { status: JOB_STATUS.FAILED } }),
    ]);
    return { pending, processing, completed, failed };
  }

  async cleanupCompletedJobs(retentionMs = JOB_RETENTION_MS) {
    const cutoff = new Date(Date.now() - retentionMs);
    const [completed, failed] = await Promise.all([
      prisma.job.deleteMany({ where: { status: JOB_STATUS.COMPLETED, processedAt: { lt: cutoff } } }),
      prisma.job.deleteMany({ where: { status: JOB_STATUS.FAILED, failedAt: { lt: cutoff } } }),
    ]);
    return completed.count + failed.count;
  }
}

export const jobQueue = new JobQueue();
