import { getIO } from './index.js';
import { projectRoom, workspaceRoom, userRoom } from './rooms/roomNames.js';

/**
 * Emit an event to everyone currently in a Socket.IO room.
 *
 * Deliberately swallows and logs failures instead of throwing: a socket
 * emission is a best-effort side effect of a REST mutation, not part of
 * its correctness. If Socket.IO isn't initialized (e.g. tests that hit
 * `createApp()`/services directly without booting `initSocketServer`), or
 * a client disconnects mid-broadcast, the REST response must still
 * succeed exactly as it did before this event existed.
 */
function safeEmit(room, event, payload) {
  try {
    const io = getIO();
    io.to(room).emit(event, payload);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[socket:emit] failed to emit "${event}" to room ${room}:`, err.message);
  }
}

/** Broadcast to everyone who has joined a project's room. */
export function emitToProject(projectId, event, payload) {
  safeEmit(projectRoom(projectId), event, payload);
}

/** Broadcast to everyone who has joined a workspace's room. */
export function emitToWorkspace(workspaceId, event, payload) {
  safeEmit(workspaceRoom(workspaceId), event, payload);
}

/**
 * Send to a single user's personal room — every authenticated socket
 * auto-joins this on connect (see rooms/handler.js), so it reaches all of
 * that user's open tabs/devices at once without needing to know which
 * socket id(s) belong to them.
 */
export function emitToUser(userId, event, payload) {
  safeEmit(userRoom(userId), event, payload);
}
