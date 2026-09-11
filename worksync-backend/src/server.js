import http from 'http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { initSocketServer } from './sockets/index.js';
import { startJobWorker, stopJobWorker } from './jobs/worker.js';

async function start() {
  await connectDatabase();

  const app = createApp();

  const server = http.createServer(app);
  initSocketServer(server);

  if (env.runWorker) startJobWorker();

  server.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`[worksync] API listening on port ${env.port} (${env.nodeEnv})`);
    // eslint-disable-next-line no-console
    console.log(`[socket] Socket.IO attached to the same HTTP server`);
  });

  const shutdown = async (signal) => {
    // eslint-disable-next-line no-console
    console.log(`[worksync] Received ${signal}, shutting down gracefully...`);
    if (env.runWorker) await stopJobWorker();
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[worksync] Failed to start server:', err);
  process.exit(1);
});
