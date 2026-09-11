import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { prisma } from '../config/database.js';
import * as userService from '../services/user.service.js';

export const getPreferences = asyncHandler(async (req, res) => {
  const preferences = await userService.getOrCreateUserPreferences(req.user.id);
  return sendSuccess(res, { message: 'Preferences retrieved', data: { preferences } });
});

export const updatePreferences = asyncHandler(async (req, res) => {
  const preferences = await userService.getOrCreateUserPreferences(req.user.id);
  const updatedPreferences = await prisma.userPreference.update({
    where: { id: preferences.id },
    data: req.body,
  });
  return sendSuccess(res, { message: 'Preferences updated', data: { updatedPreferences } });
});

export const getNotificationPreferences = asyncHandler(async (req, res) => {
  const preferences = await userService.getOrCreateNotificationPreferences(req.user.id);
  return sendSuccess(res, { message: 'Notification preferences retrieved', data: { preferences } });
});

export const updateNotificationPreferences = asyncHandler(async (req, res) => {
  const preferences = await userService.getOrCreateNotificationPreferences(req.user.id);
  const updatedPreferences = await prisma.notificationPreference.update({
    where: { id: preferences.id },
    data: req.body,
  });
  return sendSuccess(res, { message: 'Notification preferences updated', data: { updatedPreferences } });
});