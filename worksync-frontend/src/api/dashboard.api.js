import { http } from './http.js';

export const dashboardApi = {
  personal: (workspaceId, params) => http.get(`/dashboard/workspaces/${workspaceId}/personal`, params),
  workspace: (workspaceId, params) => http.get(`/dashboard/workspaces/${workspaceId}`, params),
  project: (projectId, params) => http.get(`/dashboard/projects/${projectId}`, params),
};
