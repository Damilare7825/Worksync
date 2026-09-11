import { http } from './http.js';

export const searchApi = {
  search: (workspaceId, q, filters = {}) =>
    http.get('/search', { workspaceId, q, ...filters }),
  suggestions: (workspaceId, q) =>
    http.get('/search/suggestions', { workspaceId, q }),
};
