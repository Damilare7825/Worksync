import { http } from './http.js';

export const activityApi = {
  listForWorkspace: (workspaceId, params) => http.get(`/workspaces/${workspaceId}/activity`, params),
  listForProject: (projectId, params) => http.get(`/projects/${projectId}/activity`, params),
  listForTask: (taskId, params) => http.get(`/tasks/${taskId}/activity`, params),
};
