import { http } from './http.js';

export const teamApi = {
  create: (workspaceId, data) => http.post(`/workspaces/${workspaceId}/teams`, data),
  list: (workspaceId) => http.get(`/workspaces/${workspaceId}/teams`),
  get: (id) => http.get(`/teams/${id}`),
  update: (id, data) => http.patch(`/teams/${id}`, data),
  remove: (id) => http.delete(`/teams/${id}`),
  addMember: (teamId, userId) => http.post(`/teams/${teamId}/members`, { userId }),
  removeMember: (teamId, userId) => http.delete(`/teams/${teamId}/members/${userId}`),
};
