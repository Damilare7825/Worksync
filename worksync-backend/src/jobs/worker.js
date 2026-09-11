import { jobQueue } from './queue.js';
import { logger } from '../utils/logger.js';

let isRunning = false;
let isStopping = false;
let intervalId = null;
let activeCycle = null;
let lastCleanupAt = 0;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

export async function runJobWorkerCycle() {
  if (isStopping || activeCycle) return false;

  activeCycle = (async () => {
    try {
      await jobQueue.recoverStaleJobs();
      if (Date.now() - lastCleanupAt >= CLEANUP_INTERVAL_MS) {
        await jobQueue.cleanupCompletedJobs();
        lastCleanupAt = Date.now();
      }
      const job = await jobQueue.getPendingJob();
      if (job) await jobQueue.processJob(job);
    } catch (err) {
      logger.error('[worker] Job cycle failed', { errorCode: 'JOB_CYCLE_ERROR' });
    } finally {
      activeCycle = null;
    }
  })();

  await activeCycle;
  return true;
}

export function startJobWorker(intervalMs = 1000) {
  if (isRunning) return;
  isRunning = true;
  isStopping = false;

  logger.info('[worker] Background job worker started');
  void runJobWorkerCycle();
  intervalId = globalThis.setInterval(() => void runJobWorkerCycle(), intervalMs);
}

export async function stopJobWorker() {
  if (!isRunning || isStopping) return;
  isStopping = true;
  logger.info('[worker] Stopping background worker gracefully...');

  if (intervalId) {
    globalThis.clearInterval(intervalId);
    intervalId = null;
  }

  if (activeCycle) await activeCycle;

  isRunning = false;
  logger.info('[worker] Background worker stopped');
}
