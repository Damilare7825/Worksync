import { http } from './http.js';

export const authApi = {
  register: ({ name, email, password }) => http.post('/auth/register', { name, email, password }),
  login: ({ email, password }) => http.post('/auth/login', { email, password }),
  logout: () => http.post('/auth/logout'),
  refresh: () => http.post('/auth/refresh', undefined, { skipRefresh: true }),
  me: () => http.get('/auth/me'),
  forgotPassword: (email) => http.post('/auth/forgot-password', { email }),
  resetPassword: ({ token, password }) => http.post('/auth/reset-password', { token, password }),
  changePassword: ({ currentPassword, newPassword }) =>
    http.post('/auth/change-password', { currentPassword, newPassword }),
};
