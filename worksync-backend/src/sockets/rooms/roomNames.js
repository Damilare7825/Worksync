/**
 * Single source of truth for Socket.IO room name formats, so no handler
 * (this phase or later) hardcodes a room-string format independently.
 */
export const userRoom = (userId) => `user:${userId}`;
export const workspaceRoom = (workspaceId) => `workspace:${workspaceId}`;
export const projectRoom = (projectId) => `project:${projectId}`;
