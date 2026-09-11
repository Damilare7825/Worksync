// Phase 10.1 gave us the connection lifecycle. Phase 10.2 adds
// authentication (handled upstream, in middleware/socketAuth.middleware.js,
// before `connection` ever fires) and rooms (handlers/room.handler.js).
//
// By the time a socket reaches here, socket.user is guaranteed to be set —
// unauthenticated sockets are rejected during the handshake and never emit
// `connection` at all.

import { registerRoomHandlers } from './room.handler.js';
import { cleanupSocketPresence } from '../presence.js';

/**
 * Registers connection/disconnection logging, room join/leave, and the
 * ping/pong health-check event.
 */
export function registerConnectionHandlers(io) {
  io.on('connection', (socket) => {
    // eslint-disable-next-line no-console
    console.log(`[socket] connected: ${socket.id} (user: ${socket.user.id})`);

    registerRoomHandlers(io, socket);

    socket.on('ping', (payload, callback) => {
      const response = { message: 'pong', receivedAt: new Date().toISOString() };
      if (typeof callback === 'function') {
        callback(response);
      } else {
        socket.emit('pong', response);
      }
    });

    socket.on('disconnect', (reason) => {
      cleanupSocketPresence(io, socket.id, socket.user.id);
      // eslint-disable-next-line no-console
      console.log(`[socket] disconnected: ${socket.id} (user: ${socket.user.id}, ${reason})`);
    });

    socket.on('error', (err) => {
      // eslint-disable-next-line no-console
      console.error(`[socket] error on ${socket.id}:`, err?.message || err);
    });
  });

  // Errors during the initial handshake/upgrade (bad request, engine-level
  // issues, etc.) — must not crash the process.
  io.engine.on('connection_error', (err) => {
    // eslint-disable-next-line no-console
    console.error('[socket] connection_error:', err?.message || err);
  });
}
