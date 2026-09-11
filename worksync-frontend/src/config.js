// Centralized frontend configuration. Never hardcode the API URL elsewhere.
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

// Socket.IO server URL — same host/port as the API but without the
// /api/v1 prefix, since Socket.IO mounts its own path on the HTTP server.
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;
