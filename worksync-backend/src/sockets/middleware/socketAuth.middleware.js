import { verifyToken } from '../../utils/jwt.js';
import { prisma } from '../../config/database.js';

/**
 * Socket.IO handshake middleware. Runs once per connection attempt, before
 * the `connection` event fires — a socket that fails this never reaches any
 * handler.
 *
 * Reuses the exact same JWT verification (`verifyToken`) and "attach the
 * user, minus passwordHash" shape as `src/middleware/auth.middleware.js`,
 * so there is exactly one source of truth for "is this token valid" across
 * REST and sockets. Nothing here re-implements JWT verification.
 *
 * The client sends the token via the handshake `auth` payload:
 *   io(url, { auth: { token } })
 * (a `Authorization: Bearer <token>` handshake header is also accepted, for
 * parity with the REST convention, in case a future client prefers that.)
 */
export async function authenticateSocket(socket, next) {
  try {
    const token = extractToken(socket);

    if (!token) {
      return next(new Error('Authentication required'));
    }

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      return next(new Error('Invalid or expired token'));
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, name: true, email: true, avatar: true, createdAt: true, updatedAt: true },
    });

    if (!user) {
      return next(new Error('User no longer exists'));
    }

    const session = await prisma.session.findUnique({ where: { id: payload.sessionId } });
    if (!session || session.userId !== user.id || session.revokedAt || session.expiresAt < new Date()) {
      return next(new Error('Session expired or revoked'));
    }

    // Available to every handler downstream as socket.user — same shape
    // REST controllers get as req.user.
    socket.user = user;
    next();
  } catch {
    // Never leak internals into the handshake error; log server-side only.
    // eslint-disable-next-line no-console
    console.error('[socket:auth] unexpected error during handshake authentication');
    next(new Error('Authentication failed'));
  }
}

function extractToken(socket) {
  const authToken = socket.handshake.auth?.token;
  if (authToken) {
    return authToken;
  }

  const header = socket.handshake.headers?.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme === 'Bearer' && token) {
    return token;
  }

  return null;
}
