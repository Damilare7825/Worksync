import { http } from './http.js';

export const taskApi = {
  create: (projectId, data) => http.post(`/projects/${projectId}/tasks`, data),
  list: (projectId, filters) => http.get(`/projects/${projectId}/tasks`, filters),
  listByWorkspace: (workspaceId, filters) => http.get(`/workspaces/${workspaceId}/tasks`, filters),
  get: (id) => http.get(`/tasks/${id}`),
  update: (id, data) => http.patch(`/tasks/${id}`, data),
  move: (id, data) => http.patch(`/tasks/${id}/move`, data),
  bulkUpdate: (data) => http.post('/tasks/bulk', data),
  remove: (id) => http.delete(`/tasks/${id}`),


  // Checklist
  listChecklist: (taskId) => http.get(`/tasks/${taskId}/checklist`),
  addChecklistItem: (taskId, text) => http.post(`/tasks/${taskId}/checklist`, { text }),
  updateChecklistItem: (itemId, data) => http.patch(`/checklist-items/${itemId}`, data),
  deleteChecklistItem: (itemId) => http.delete(`/checklist-items/${itemId}`),
  reorderChecklist: (taskId, itemIds) => http.post(`/tasks/${taskId}/checklist/reorder`, { itemIds }),

  // Watchers
  listWatchers: (taskId) => http.get(`/tasks/${taskId}/watchers`),
  watch: (taskId) => http.post(`/tasks/${taskId}/watchers`),
  unwatch: (taskId) => http.delete(`/tasks/${taskId}/watchers`),

  // Dependencies
  addDependency: (taskId, dependsOnTaskId) => http.post(`/tasks/${taskId}/dependencies`, { dependsOnTaskId }),
  removeDependency: (taskId, dependsOnTaskId) => http.delete(`/tasks/${taskId}/dependencies/${dependsOnTaskId}`),

  // Recurrence
  getRecurrence: (taskId) => http.get(`/tasks/${taskId}/recurrence`),
  setRecurrence: (taskId, data) => http.put(`/tasks/${taskId}/recurrence`, data),
  removeRecurrence: (taskId) => http.delete(`/tasks/${taskId}/recurrence`),

  // Labels on a task
  addLabel: (taskId, labelId) => http.post(`/tasks/${taskId}/labels`, { labelId }),
  removeLabel: (taskId, labelId) => http.delete(`/tasks/${taskId}/labels/${labelId}`),
};

export const labelApi = {
  list: (workspaceId) => http.get(`/workspaces/${workspaceId}/labels`),
  create: (workspaceId, data) => http.post(`/workspaces/${workspaceId}/labels`, data),
  remove: (workspaceId, labelId) => http.delete(`/workspaces/${workspaceId}/labels/${labelId}`),
};
