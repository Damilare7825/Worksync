import { http } from './http.js';

export const userApi = {
  // Backend route is registered as PUT /users/me, not PATCH — matching
  // exactly rather than guessing a more RESTful-looking verb.
  updateProfile: (data) => http.put('/users/me', data),
  getPreferences: () => http.get('/users/me/preferences'),
  updatePreferences: (data) => http.patch('/users/me/preferences', data),
  getNotificationPreferences: () => http.get('/users/me/notification-preferences'),
  updateNotificationPreferences: (data) => http.patch('/users/me/notification-preferences', data),
  uploadAvatar: (file) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return http.post('/users/me/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  deleteAvatar: () => http.delete('/users/me/avatar'),
};