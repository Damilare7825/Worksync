import crypto from 'crypto';

/**
 * Request ID middleware. Generates or propagates X-Request-ID header.
 * Attaches `req.id` to the request object and sets X-Request-ID response header.
 */
export function requestIdMiddleware(req, res, next) {
  const existingId = req.headers['x-request-id'];
  const requestId = existingId && typeof existingId === 'string' ? existingId : crypto.randomUUID();

  req.id = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
}
