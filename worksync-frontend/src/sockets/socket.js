import { io } from 'socket.io-client';
import { SOCKET_URL } from '../config.js';
import { getToken } from '../api/http.js';

// Single shared socket instance for the whole app. Components/contexts
// should call connectSocket()/getSocket() instead of creating their own
// `io(...)` connections — one connection per browser tab, not one per
// component.
let socket = null;

/**
 * Create (if needed) and connect the shared socket.
 *
 * The JWT is read fresh on every (re)connect attempt via the `auth`
 * callback form, rather than baked in once at socket creation — so a
 * token obtained after this module first loaded (e.g. logging in in the
 * same tab) is still picked up correctly, and reconnects after a token
 * refresh use the current token rather than a stale one.
 */
export function connectSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      withCredentials: true,
      auth: (cb) => cb({ token: getToken() }),
    });
  }

  if (!socket.connected) {
    socket.connect();
  }

  return socket;
}

/** Disconnect the shared socket, if connected. Safe to call repeatedly. */
export function disconnectSocket() {
  if (socket?.connected) {
    socket.disconnect();
  }
}

/**
 * Access the shared socket instance without connecting it.
 * Returns null if connectSocket() has never been called.
 */
export function getSocket() {
  return socket;
}
