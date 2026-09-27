import rateLimit from 'express-rate-limit';

/**
 * General API rate limiter — generous, applied globally.
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please try again later',
    error: { code: 'RATE_LIMITED' },
  },
});

/**
 * Stricter limiter for auth endpoints to slow down brute-force attempts.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later',
    error: { code: 'RATE_LIMITED' },
  },
});

/**
 * Dedicated limiter for password reset requests to prevent email bombing
 * and token harvesting attacks.
 */
export const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many password reset attempts, please try again later',
    error: { code: 'RATE_LIMITED' },
  },
});

/**
 * Limiter for public invite links and workspace joining endpoints.
 */
export const inviteLinkLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many invite verification attempts, please try again later',
    error: { code: 'RATE_LIMITED' },
  },
});

\n