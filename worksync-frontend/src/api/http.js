import { API_BASE_URL } from '../config.js';
import { ApiError } from './ApiError.js';
import { authApi } from './auth.api.js';

let accessToken = null;

export function getToken() {
  return accessToken;
}

export function setToken(token) {
  accessToken = token || null;
}

export function clearToken() {
  accessToken = null;
}

let onUnauthorized = null;
export function registerUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

let isRefreshing = false;
let refreshPromise = null;

async function attemptRefresh() {
  if (isRefreshing) return refreshPromise;
  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const res = await authApi.refresh();
      setToken(res.data.token);
      return true;
    } catch {
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

async function request(path, { method = 'GET', body, params, skipRefresh = false } = {}) {
  const url = new URL(`${API_BASE_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, value);
      }
    });
  }

  const token = getToken();
  const headers = {};
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(url.toString(), {
      method,
      headers,
      body: body !== undefined ? (isFormData ? body : JSON.stringify(body)) : undefined,
      credentials: 'include',
    });
  } catch {
    throw new ApiError('Network error — check your connection and that the API is reachable.', {
      code: 'NETWORK_ERROR',
    });
  }

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    // No JSON body (e.g. 204) — fine for successful responses.
  }

  if (!res.ok) {
    const message = payload?.message || payload?.error?.message || res.statusText || 'Request failed';
    const code = payload?.error?.code;
    const details = payload?.error?.details;

    if (res.status === 401 && !skipRefresh) {
      const refreshed = await attemptRefresh();
      if (refreshed) {
        const retryRes = await fetch(url.toString(), {
          method,
          headers: {
            ...headers,
            Authorization: `Bearer ${getToken()}`,
          },
          body: body !== undefined ? (isFormData ? body : JSON.stringify(body)) : undefined,
          credentials: 'include',
        });
        let retryPayload = null;
        try {
          retryPayload = await retryRes.json();
        } catch {
          // ignore
        }
        if (retryRes.ok) {
          return retryPayload;
        }
      }

      if (onUnauthorized) {
        onUnauthorized();
      }
    }

    throw new ApiError(message, { status: res.status, code, details });
  }

  return payload;
}

export const http = {
  get: (path, params) => request(path, { method: 'GET', params }),
  post: (path, body, options = {}) => request(path, { method: 'POST', body, ...options }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  delete: (path) => request(path, { method: 'DELETE' }),
  upload: (path, formData) => request(path, { method: 'POST', body: formData }),
};
