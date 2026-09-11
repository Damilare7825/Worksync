import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import * as userService from '../services/user.service.js';
import { validateAvatarFile } from '../validators/attachment.validator.js';

export const getMe = asyncHandler(async (req, res) => {
  const user = await userService.getUserById(req.user.id, { includeEmail: true });
  return sendSuccess(res, { message: 'Profile retrieved', data: { user } });
});

export const updateMe = asyncHandler(async (req, res) => {
  const user = await userService.updateOwnProfile(req.user.id, req.body);
  return sendSuccess(res, { message: 'Profile updated', data: { user } });
});

export const deleteMe = asyncHandler(async (req, res) => {
  await userService.deleteOwnAccount(req.user.id);
  // 204 No Content must not include a response body.
  return res.status(204).send();
});

export const getUserPublicProfile = asyncHandler(async (req, res) => {
  const user = await userService.getUserById(req.params.id);
  return sendSuccess(res, { message: 'User retrieved', data: { user } });
});

export const uploadAvatar = asyncHandler(async (req, res) => {
  validateAvatarFile(req.file);
  const avatar = await userService.uploadAvatar(req.user.id, req.file);
  return sendSuccess(res, { message: 'Avatar uploaded', data: { avatar } });
});

export const deleteAvatar = asyncHandler(async (req, res) => {
  await userService.deleteAvatar(req.user.id);
  return sendSuccess(res, { message: 'Avatar deleted' });
});
