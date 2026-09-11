import { http } from './http.js';

export const invitationApi = {
  getByToken: (token) => http.get(`/invitations/${token}`),
  accept: (token) => http.post(`/invitations/${token}/accept`),
  decline: (token) => http.post(`/invitations/${token}/decline`),

  // ID-based variants for the in-app invitation-notification flow, which
  // never has the raw token (only invitationId is stored on the
  // notification — the token itself is never persisted anywhere).
  getById: (id) => http.get(`/invitations/id/${id}`),
  acceptById: (id) => http.post(`/invitations/id/${id}/accept`),
};
