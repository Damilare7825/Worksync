import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { signToken } from '../utils/jwt.js';
import { generateResetToken, hashResetToken, generateRefreshToken, hashRefreshToken } from '../utils/token.js';
import { sendPasswordResetEmail } from './email/index.js';
import { ConflictError, UnauthorizedError, BadRequestError } from '../utils/errors.js';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Same pattern as buildInviteUrl (invitation.service.js) and the workspace
// join link (workspace.service.js) — the raw token belongs in a real,
// clickable frontend URL, not passed bare into the email template.
function buildResetUrl(rawToken) {
  return `${env.clientUrl}/reset-password?token=${rawToken}`;
}

const SAFE_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  avatar: true,
  createdAt: true,
  updatedAt: true,
};

async function createSession(userId, refreshToken) {
  const refreshTokenHash = refreshToken ? hashRefreshToken(refreshToken) : null;
  const session = await prisma.session.create({
    data: {
      userId,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      refreshTokenHash,
    },
  });
  return session;
}

async function invalidateUserSessions(userId) {
  await prisma.session.deleteMany({ where: { userId } });
}

export async function registerUser({ name, email, password }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new ConflictError('An account with this email already exists', 'EMAIL_TAKEN');
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: { name, email, passwordHash },
    select: SAFE_USER_SELECT,
  });

  const refreshToken = generateRefreshToken();
  const session = await createSession(user.id, refreshToken);
  const token = signToken({ userId: user.id, email: user.email, sessionId: session.id });
  return { user, token, refreshToken };
}

export async function loginUser({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  const refreshToken = generateRefreshToken();
  const session = await createSession(user.id, refreshToken);
  const token = signToken({ userId: user.id, email: user.email, sessionId: session.id });
  const { passwordHash: _omit, ...safeUser } = user;
  return { user: safeUser, token, refreshToken };
}

export async function refreshAccessToken(rawRefreshToken) {
  const refreshTokenHash = hashRefreshToken(rawRefreshToken);

  const session = await prisma.session.findFirst({
    where: {
      refreshTokenHash,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  if (!session) {
    throw new UnauthorizedError('Invalid or expired refresh token', 'TOKEN_INVALID');
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) {
    throw new UnauthorizedError('User no longer exists', 'TOKEN_INVALID');
  }

  const newRefreshToken = generateRefreshToken();
  const newRefreshTokenHash = hashRefreshToken(newRefreshToken);

  const updated = await prisma.session.updateMany({
    where: {
      id: session.id,
      refreshTokenHash: session.refreshTokenHash,
      revokedAt: null,
    },
    data: {
      refreshTokenHash: newRefreshTokenHash,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  });

  if (updated.count === 0) {
    throw new UnauthorizedError('Refresh token was already used or revoked', 'TOKEN_INVALID');
  }

  const token = signToken({ userId: user.id, email: user.email, sessionId: session.id });
  return { token, refreshToken: newRefreshToken };
}

export async function requestPasswordReset(email) {
  const user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    const { token, tokenHash } = generateResetToken();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordTokenHash: tokenHash,
        resetPasswordExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });
    await sendPasswordResetEmail(user.email, buildResetUrl(token));
  }

  return { message: 'If an account exists for that email, a password reset link has been sent.' };
}

export async function resetPassword({ token, password }) {
  const tokenHash = hashResetToken(token);

  const user = await prisma.user.findFirst({
    where: {
      resetPasswordTokenHash: tokenHash,
      resetPasswordExpiresAt: { gt: new Date() },
    },
  });

  if (!user) {
    throw new BadRequestError('This reset link is invalid or has expired', 'INVALID_RESET_TOKEN');
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      resetPasswordTokenHash: null,
      resetPasswordExpiresAt: null,
    },
  });

  await invalidateUserSessions(user.id);
}

export async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new UnauthorizedError('User no longer exists', 'TOKEN_INVALID');
  }

  const valid = await comparePassword(currentPassword, user.passwordHash);
  if (!valid) {
    throw new UnauthorizedError('Current password is incorrect', 'INVALID_CURRENT_PASSWORD');
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash,
      resetPasswordTokenHash: null,
      resetPasswordExpiresAt: null,
    },
  });

  await invalidateUserSessions(userId);
}

export async function logoutUser(userId, sessionId) {
  if (sessionId) {
    await prisma.session.delete({ where: { id: sessionId } });
  } else {
    await invalidateUserSessions(userId);
  }
}
