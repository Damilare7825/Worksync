import { Server } from 'socket.io';
import { env } from '../config/env.js';

// Single Socket.IO server instance, created once in initSocketServer()
// and retrievable via getIO() by any handler/service that needs to emit
// events later (Phase 10.2+ domain events).
let io = null;

/**
 * Create the Socket.IO server and attach it to the existing Node HTTP
 * server (the same server the Express app listens on). This keeps a
 * single process/port for both REST and real-time traffic.
 *
 * CORS mirrors the existing REST API's allowed origins and reads from
 * env.clientUrl (CLIENT_URL) rather than a hardcoded URL, so dev/staging/
 * prod all behave correctly without code changes.
 */
export function createSocketServer(httpServer) {
  if (io) {
    return io;
  }

  io = new Server(httpServer, {
    cors: {
      origin: env.clientUrl,
      credentials: true,
    },
    // Keep connection state recovery off by default for now — Phase 10.2+
    // can opt into it once rooms/auth are in place.
  });

  return io;
}

/**
 * Access the already-created io instance. Throws if called before
 * createSocketServer() has run, so misuse fails loudly instead of
 * silently emitting to nothing.
 */
export function getIO() {
  if (!io) {
    throw new Error('[socket] getIO() called before createSocketServer(). Sockets are not initialized yet.');
  }
  return io;
}
