import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import * as authService from '../services/auth.service.js';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { ForbiddenError, UnauthorizedError } from '../utils/errors.js';

const REFRESH_COOKIE = 'worksync_refresh_token';
const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    path: '/api/v1/auth',
  };
}

function getCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;
  const prefix = `${name}=`;
  const value = header.split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix));
  if (!value) return null;
  try {
    return decodeURIComponent(value.slice(prefix.length));
  } catch {
    return null;
  }
}

function assertTrustedRefreshOrigin(req) {
  const origin = req.get('origin');
  // SameSite=Lax prevents cross-site POSTs; validating an Origin supplied by
  // a browser adds defense in depth without breaking non-browser clients.
  if (origin && !env.allowedOrigins.includes(origin)) {
    throw new ForbiddenError('Refresh request origin is not allowed', 'CSRF_ORIGIN_DENIED');
  }
}

function setRefreshCookie(res, refreshToken) {
  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
}

function clearRefreshCookie(res) {
  const { maxAge: _maxAge, ...options } = refreshCookieOptions();
  res.clearCookie(REFRESH_COOKIE, options);
}

export const register = asyncHandler(async (req, res) => {
  const { user, token, refreshToken } = await authService.registerUser(req.body);
  setRefreshCookie(res, refreshToken);
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Account created successfully',
    data: { user, token },
  });
});

export const login = asyncHandler(async (req, res) => {
  const { user, token, refreshToken } = await authService.loginUser(req.body);
  setRefreshCookie(res, refreshToken);
  return sendSuccess(res, { message: 'Logged in successfully', data: { user, token } });
});

export const me = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, name: true, email: true, avatar: true, createdAt: true, updatedAt: true },
  });
  return sendSuccess(res, { message: 'Current user retrieved', data: { user } });
});

export const refresh = asyncHandler(async (req, res) => {
  assertTrustedRefreshOrigin(req);
  const refreshToken = getCookie(req, REFRESH_COOKIE);
  if (!refreshToken) throw new UnauthorizedError('Missing refresh credential', 'TOKEN_INVALID');
  const { token, refreshToken: rotatedRefreshToken } = await authService.refreshAccessToken(refreshToken);
  setRefreshCookie(res, rotatedRefreshToken);
  return sendSuccess(res, { message: 'Token refreshed', data: { token } });
});

export const logout = asyncHandler(async (req, res) => {
  await authService.logoutUser(req.user.id, req.sessionId);
  clearRefreshCookie(res);
  return sendSuccess(res, { message: 'Logged out successfully', data: null });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const { message } = await authService.requestPasswordReset(req.body.email);
  return sendSuccess(res, { message, data: null });
});

export const resetPassword = asyncHandler(async (req, res) => {
  await authService.resetPassword(req.body);
  return sendSuccess(res, {
    message: 'Password reset successfully. Please log in with your new password.',
    data: null,
  });
});

export const changePassword = asyncHandler(async (req, res) => {
  await authService.changePassword(req.user.id, req.body);
  return sendSuccess(res, { message: 'Password changed successfully', data: null });
});
