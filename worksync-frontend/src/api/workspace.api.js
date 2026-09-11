import { http } from './http.js';

export const workspaceApi = {
  create: (name) => http.post('/workspaces', { name }),
  list: () => http.get('/workspaces'),
  get: (id) => http.get(`/workspaces/${id}`),
  update: (id, data) => http.patch(`/workspaces/${id}`, data),
  remove: (id) => http.delete(`/workspaces/${id}`),

  listMembers: (id, params) => http.get(`/workspaces/${id}/members`, params),
  updateMemberRole: (id, memberId, role) =>
    http.patch(`/workspaces/${id}/members/${memberId}`, { role }),
  removeMember: (id, memberId) => http.delete(`/workspaces/${id}/members/${memberId}`),

  invite: (id, { email, role }) => http.post(`/workspaces/${id}/invitations`, { email, role }),
  listPendingInvitations: (id) => http.get(`/workspaces/${id}/invitations/pending`),
  resendInvitation: (id, invitationId) =>
    http.post(`/workspaces/${id}/invitations/${invitationId}/resend`),
  cancelInvitation: (id, invitationId) =>
    http.delete(`/workspaces/${id}/invitations/${invitationId}`),

  // Shareable invite link — a second, non-email-bound way to invite.
  getInviteLink: (id) => http.get(`/workspaces/${id}/invite-link`),
  enableInviteLink: (id, role) => http.post(`/workspaces/${id}/invite-link/enable`, { role }),
  disableInviteLink: (id) => http.post(`/workspaces/${id}/invite-link/disable`),
  regenerateInviteLink: (id) => http.post(`/workspaces/${id}/invite-link/regenerate`),
};
