import { connectDatabase, disconnectDatabase } from './config/database.js';
import { startJobWorker, stopJobWorker } from './jobs/worker.js';
import { logger } from './utils/logger.js';

let shuttingDown = false;

async function start() {
  await connectDatabase();
  startJobWorker();
  logger.info('[worker] WorkSync worker process started');

  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`[worker] Received ${signal}, shutting down gracefully...`);
    await stopJobWorker();
    await disconnectDatabase();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

start().catch(async () => {
  logger.error('[worker] Failed to start worker', { errorCode: 'WORKER_STARTUP_ERROR' });
  await disconnectDatabase().catch(() => {});
  process.exit(1);
});
