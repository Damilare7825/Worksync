import { verifyToken } from '../utils/jwt.js';
import { UnauthorizedError } from '../utils/errors.js';
import { prisma } from '../config/database.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw new UnauthorizedError('Missing or invalid authorization header');
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw new UnauthorizedError('Invalid or expired token', 'TOKEN_INVALID');
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, name: true, email: true, avatar: true, createdAt: true, updatedAt: true },
  });

  if (!user) {
    throw new UnauthorizedError('User no longer exists', 'TOKEN_INVALID');
  }

  const session = await prisma.session.findUnique({ where: { id: payload.sessionId } });
  if (!session || session.userId !== user.id || session.revokedAt || session.expiresAt < new Date()) {
    throw new UnauthorizedError('Session expired or revoked', 'TOKEN_INVALID');
  }

  req.user = user;
  req.sessionId = session.id;
  next();
});
