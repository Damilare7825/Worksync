import { http } from './http.js';

export const inviteLinkApi = {
  preview: (token) => http.get(`/join/${token}`),
  join: (token) => http.post(`/join/${token}/join`),
};
