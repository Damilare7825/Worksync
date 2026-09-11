import { http, getToken } from './http.js';
import { API_BASE_URL } from '../config.js';

export const attachmentApi = {
  upload: (formData) => http.upload('/attachments/upload', formData),
  list: (params) => http.get('/attachments', params),
  get: (id) => http.get(`/attachments/${id}`),
  delete: (id) => http.delete(`/attachments/${id}`),
  
  getDownloadUrl: (id, inline = false) => {
    return `${API_BASE_URL}/attachments/${id}/download?inline=${inline}`;
  },

  async fetchBlob(id, inline = false) {
    const url = `${API_BASE_URL}/attachments/${id}/download?inline=${inline}`;
    const token = getToken();
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error('Failed to download attachment');
    }
    const blob = await res.blob();
    return {
      blob,
      contentType: res.headers.get('Content-Type'),
      objectUrl: URL.createObjectURL(blob),
    };
  },
};
