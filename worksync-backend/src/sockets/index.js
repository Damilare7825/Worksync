import { createSocketServer, getIO } from './socketServer.js';
import { authenticateSocket } from './middleware/socketAuth.middleware.js';
import { registerConnectionHandlers } from './handlers/connection.handler.js';

/**
 * Phase 10.1 entry point, extended in Phase 10.2 with handshake
 * authentication. Attaches Socket.IO to the given HTTP server, rejects
 * unauthenticated connections at the handshake, and registers the
 * connection lifecycle + room handlers.
 *
 * Later phases plug in here without changing this function's shape:
 *   - 10.3+: registerTaskHandlers(io), registerCommentHandlers(io),
 *           registerNotificationHandlers(io), ...
 */
export function initSocketServer(httpServer) {
  const io = createSocketServer(httpServer);

  io.use(authenticateSocket);

  registerConnectionHandlers(io);

  return io;
}

export { getIO };
