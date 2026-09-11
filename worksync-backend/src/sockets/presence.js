import { workspaceRoom } from './rooms/roomNames.js';

/**
 * In-memory presence tracking: workspaceId -> userId -> Set<socketId>.
 *
 * Tracking by socket id (not just userId) matters because one user can
 * have multiple tabs/devices open — presence should only flip to
 * "offline" once their *last* connection to that workspace closes, not
 * their first.
 *
 * This is single-process, in-memory state. It's correct as long as
 * WorkSync runs one backend process. If it's ever horizontally scaled to
 * multiple instances, this needs to move to a shared store (Redis pub/sub
 * or similar) — a socket connected to instance A can't currently see
 * presence for a socket connected to instance B.
 */
const presenceByWorkspace = new Map();

// socketId -> Set<workspaceId>, so a disconnecting socket can clean up
// every workspace it was present in without the caller having to track
// which workspaces that particular socket had joined.
const workspacesBySocket = new Map();

export function addPresence(io, workspaceId, userId, socketId) {
  if (!presenceByWorkspace.has(workspaceId)) {
    presenceByWorkspace.set(workspaceId, new Map());
  }
  const users = presenceByWorkspace.get(workspaceId);
  const wasOnline = users.has(userId);

  if (!users.has(userId)) {
    users.set(userId, new Set());
  }
  users.get(userId).add(socketId);

  if (!workspacesBySocket.has(socketId)) {
    workspacesBySocket.set(socketId, new Set());
  }
  workspacesBySocket.get(socketId).add(workspaceId);

  if (!wasOnline) {
    io.to(workspaceRoom(workspaceId)).emit('presence.online', { workspaceId, userId });
  }
}

export function removePresence(io, workspaceId, userId, socketId) {
  const users = presenceByWorkspace.get(workspaceId);
  if (!users || !users.has(userId)) return;

  const sockets = users.get(userId);
  sockets.delete(socketId);

  if (sockets.size === 0) {
    users.delete(userId);
    io.to(workspaceRoom(workspaceId)).emit('presence.offline', { workspaceId, userId });
  }
  if (users.size === 0) {
    presenceByWorkspace.delete(workspaceId);
  }

  const wsSet = workspacesBySocket.get(socketId);
  if (wsSet) {
    wsSet.delete(workspaceId);
    if (wsSet.size === 0) {
      workspacesBySocket.delete(socketId);
    }
  }
}

/** Current online user ids for a workspace — used to seed a client's view on join. */
export function getOnlineUserIds(workspaceId) {
  const users = presenceByWorkspace.get(workspaceId);
  return users ? Array.from(users.keys()) : [];
}

/**
 * Called on socket disconnect. Removes this socket's presence from every
 * workspace it was registered in, so a dropped connection (tab closed,
 * network loss, server restart) can't leave a user stuck showing "online"
 * forever.
 */
export function cleanupSocketPresence(io, socketId, userId) {
  const wsSet = workspacesBySocket.get(socketId);
  if (!wsSet) return;

  // Copy first — removePresence() mutates wsSet as it runs.
  for (const workspaceId of Array.from(wsSet)) {
    removePresence(io, workspaceId, userId, socketId);
  }
}
