import { assertWorkspaceMembership, assertProjectAccess } from '../../services/authorization.service.js';
import { userRoom, workspaceRoom, projectRoom } from '../rooms/roomNames.js';
import { addPresence, removePresence, getOnlineUserIds } from '../presence.js';

/**
 * Phase 10.2: workspace/project room join & leave.
 *
 * No domain events are emitted into these rooms yet — that starts in
 * Phase 10.3+ (task.created, comment.created, etc.). This phase only
 * establishes: which rooms exist, and who is allowed to join them.
 *
 * Every join re-checks membership against the database via
 * `authorization.service` — the same functions REST routes use — so a
 * socket can never join a room for a workspace/project the user isn't
 * actually a member of, and access is re-verified on every join rather
 * than cached from the handshake.
 */
export function registerRoomHandlers(io, socket) {
  // Every authenticated socket automatically gets its own personal room.
  // Nothing publishes to it yet, but Phase 10.5 (notifications) needs a
  // per-user target that doesn't depend on workspace/project membership.
  socket.join(userRoom(socket.user.id));

  socket.on('workspace:join', async (payload, callback) => {
    const workspaceId = payload?.workspaceId;
    const ack = typeof callback === 'function' ? callback : () => {};

    if (!workspaceId) {
      return ack({ ok: false, error: 'workspaceId is required' });
    }

    try {
      await assertWorkspaceMembership(socket.user.id, workspaceId);
      socket.join(workspaceRoom(workspaceId));
      addPresence(io, workspaceId, socket.user.id, socket.id);
      // Seed the joining client with who's already online — presence.online
      // events only fire for transitions, so without this a client that
      // joins after others are already connected would see no one.
      ack({ ok: true, room: workspaceRoom(workspaceId), onlineUserIds: getOnlineUserIds(workspaceId) });
    } catch (err) {
      ack({ ok: false, error: err.message || 'Unable to join workspace room' });
    }
  });

  socket.on('workspace:leave', (payload, callback) => {
    const workspaceId = payload?.workspaceId;
    const ack = typeof callback === 'function' ? callback : () => {};

    if (!workspaceId) {
      return ack({ ok: false, error: 'workspaceId is required' });
    }

    socket.leave(workspaceRoom(workspaceId));
    removePresence(io, workspaceId, socket.user.id, socket.id);
    ack({ ok: true });
  });

  socket.on('project:join', async (payload, callback) => {
    const projectId = payload?.projectId;
    const ack = typeof callback === 'function' ? callback : () => {};

    if (!projectId) {
      return ack({ ok: false, error: 'projectId is required' });
    }

    try {
      await assertProjectAccess(socket.user.id, projectId);
      socket.join(projectRoom(projectId));
      ack({ ok: true, room: projectRoom(projectId) });
    } catch (err) {
      ack({ ok: false, error: err.message || 'Unable to join project room' });
    }
  });

  socket.on('project:leave', (payload, callback) => {
    const projectId = payload?.projectId;
    const ack = typeof callback === 'function' ? callback : () => {};

    if (!projectId) {
      return ack({ ok: false, error: 'projectId is required' });
    }

    socket.leave(projectRoom(projectId));
    ack({ ok: true });
  });
}
