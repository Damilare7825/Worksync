import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

/**
 * Sign a JWT containing only the minimum claims needed to identify a user.
 * Never embed sensitive data (passwordHash, etc.) in the token payload.
 */
export function signToken({ userId, sessionId }) {
  // User identity and session ownership are resolved server-side on every
  // request. Keep the bearer payload minimal and pin the signing algorithm.
  return jwt.sign({ userId, sessionId }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
    algorithm: 'HS256',
  });
}

export function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
}
