import { prisma } from '../config/database.js';
import { NotFoundError } from '../utils/errors.js';
import { storageService } from '../services/storage/storage.service.js';

const SAFE_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  avatar: true,
  bio: true,
  createdAt: true,
  updatedAt: true,
};

const PUBLIC_USER_SELECT = {
  id: true,
  name: true,
  avatar: true,
};

export async function getUserById(id, { includeEmail = false } = {}) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: includeEmail ? SAFE_USER_SELECT : PUBLIC_USER_SELECT,
  });
  if (!user) throw new NotFoundError('User not found', 'USER_NOT_FOUND');
  return user;
}

export async function updateOwnProfile(userId, updates) {
  return prisma.user.update({
    where: { id: userId },
    data: updates,
    select: SAFE_USER_SELECT,
  });
}

export async function getOrCreateUserPreferences(userId) {
  let preferences = await prisma.userPreference.findUnique({
    where: { userId },
  });

  if (!preferences) {
    preferences = await prisma.userPreference.create({
      data: {
        userId,
      },
    });
  }

  return preferences;
}

export async function getOrCreateNotificationPreferences(userId) {
  let preferences = await prisma.notificationPreference.findUnique({
    where: { userId },
  });

  if (!preferences) {
    preferences = await prisma.notificationPreference.create({
      data: {
        userId,
      },
    });
  }

  return preferences;
}

export async function deleteOwnAccount(userId) {
  await prisma.user.delete({ where: { id: userId } });
}

export async function uploadAvatar(userId, file) {
  // Validate the file using avatar-specific validation
  const { validateAvatarFile } = await import('../validators/attachment.validator.js');
  validateAvatarFile(file);

  // Upload to storage
  const { storageKey, storageProvider } = await storageService.upload(file.buffer, file.originalname);

  // Update user's avatar field in database
  await prisma.user.update({
    where: { id: userId },
    data: { avatar: storageKey },
    select: { id: true, avatar: true },
  });

  return { storageKey, storageProvider };
}

export async function deleteAvatar(userId) {
  // Get current user to get the avatar storage key
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatar: true },
  });

  // If user has an avatar, delete it from storage
  if (user?.avatar) {
    await storageService.delete(user.avatar);
  }

  // Clear the avatar field in database
  await prisma.user.update({
    where: { id: userId },
    data: { avatar: null },
  });

  return { success: true };
}