import crypto from 'crypto';

/**
 * Generates a password reset token pair: the raw token (sent to the user,
 * never stored) and its SHA-256 hash (stored in the DB). This mirrors how
 * we handle passwords — the database never holds a value that's directly
 * usable if it leaks.
 */
export function generateResetToken() {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashResetToken(token);
  return { token, tokenHash };
}

export function generateRefreshToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}
