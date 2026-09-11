import { http } from './http.js';

export const commentApi = {
  create: (taskId, { content, parentCommentId, mentionedUserIds }) =>
    http.post(`/tasks/${taskId}/comments`, { content, parentCommentId, mentionedUserIds }),
  list: (taskId) => http.get(`/tasks/${taskId}/comments`),
  update: (id, { content, mentionedUserIds }) => http.patch(`/comments/${id}`, { content, mentionedUserIds }),
  remove: (id) => http.delete(`/comments/${id}`),

  addReaction: (id, emoji) => http.post(`/comments/${id}/reactions`, { emoji }),
  removeReaction: (id, emoji) => http.delete(`/comments/${id}/reactions/${encodeURIComponent(emoji)}`),

  resolve: (id) => http.post(`/comments/${id}/resolve`),
  reopen: (id) => http.post(`/comments/${id}/reopen`),
};
