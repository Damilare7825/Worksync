import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import * as notificationService from '../services/notification.service.js';
import { getPaginationParams, buildPaginationMeta } from '../utils/pagination.js';

export const list = asyncHandler(async (req, res) => {
  const { page, limit, skip, take } = getPaginationParams(req.query);
  const unreadOnly = req.query.unread === 'true';
  const { items, total } = await notificationService.listNotifications(req.user.id, {
    skip,
    take,
    unreadOnly,
  });
  return sendSuccess(res, {
    message: 'Notifications retrieved',
    data: { notifications: items },
    meta: buildPaginationMeta({ page, limit, total }),
  });
});

export const markRead = asyncHandler(async (req, res) => {
  const notification = await notificationService.markNotificationRead(req.user.id, req.params.id);
  return sendSuccess(res, { message: 'Notification marked as read', data: { notification } });
});

export const markAllRead = asyncHandler(async (req, res) => {
  await notificationService.markAllNotificationsRead(req.user.id);
  return sendSuccess(res, { message: 'All notifications marked as read', data: null });
});
