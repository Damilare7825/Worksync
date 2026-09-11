import { http } from './http.js';

export const projectApi = {
  create: (workspaceId, data) => http.post(`/workspaces/${workspaceId}/projects`, data),
  list: (workspaceId, params) => http.get(`/workspaces/${workspaceId}/projects`, params),
  get: (id) => http.get(`/projects/${id}`),
  update: (id, data) => http.patch(`/projects/${id}`, data),
  remove: (id) => http.delete(`/projects/${id}`),
  archive: (id) => http.post(`/projects/${id}/archive`),
  restore: (id, status) => http.post(`/projects/${id}/restore`, status ? { status } : undefined),
  getStats: (id) => http.get(`/projects/${id}/stats`),

  listMembers: (projectId) => http.get(`/projects/${projectId}/members`),
  addMember: (projectId, { userId, role }) => http.post(`/projects/${projectId}/members`, { userId, role }),
  updateMember: (projectId, memberId, role) =>
    http.patch(`/projects/${projectId}/members/${memberId}`, { role }),
  removeMember: (projectId, memberId) => http.delete(`/projects/${projectId}/members/${memberId}`),
};
