import { prisma } from '../config/database.js';
import { NotFoundError } from '../utils/errors.js';
import { emitToUser } from '../sockets/emit.js';
import * as userService from './user.service.js';

/**
 * Internal helper used by other services (task assignment, comments,
 * invitations, role changes) to create a notification. Not exposed
 * directly as an endpoint — notifications are created as a side effect of
 * other actions, never by direct client request.
 *
 * Single choke point every notification-producing action goes through, so
 * it's also the single place real-time notification broadcasting lives —
 * every caller gets a live `notification.created` event for free, sent
 * only to the recipient's own room.
 */
export async function createNotification({ userId, type, title, message, invitationId }, preferences) {
  // Get user's notification preferences to check if this notification type is enabled
  // Use cached preferences if provided, otherwise fetch from database
  const prefs = preferences ?? await userService.getOrCreateNotificationPreferences(userId);

  // Map notification types to preference fields
  const notificationTypeMap = {
    TASK_ASSIGNED: prefs.taskAssignments,
    TASK_UPDATE: prefs.taskUpdates,
    DEADLINE_REMINDER: prefs.dueDateReminders,
    MENTION: prefs.mentions,
    COMMENT: prefs.comments,
    REPLY: prefs.replies, // Map reply notifications to replies preference
    REACTION: prefs.reactions,
    INVITATION: prefs.invitations,
    PROJECT_UPDATE: prefs.projectActivity,
    WORKSPACE_ACTIVITY: prefs.workspaceActivity,
    DISCUSSION_RESOLVED: prefs.comments, // Using comments preference for discussion resolved
    ROLE_CHANGE: prefs.workspaceActivity, // Using workspace activity preference for role changes
  };

  // Check if this notification type is enabled for the user
  // Default to true for unknown types (enabled by default)
  const isEnabled = notificationTypeMap[type] ?? true;

  // If notifications are explicitly disabled for this type, don't create the notification
  if (isEnabled === false) {
    return null;
  }

  const notification = await prisma.notification.create({ data: { userId, type, title, message, invitationId } });
  emitToUser(userId, 'notification.created', { notification });
  return notification;
}

export async function listNotifications(userId, { skip, take, unreadOnly }) {
  const where = { userId, ...(unreadOnly ? { read: false } : {}) };
  const [items, total] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
    prisma.notification.count({ where }),
  ]);
  return { items, total };
}

export async function markNotificationRead(userId, notificationId) {
  const notification = await prisma.notification.findUnique({ where: { id: notificationId } });
  // Scope strictly to the owner — a notification ID alone must never let
  // one user mark (or even detect the existence of) another user's
  // notification.
  if (!notification || notification.userId !== userId) {
    throw new NotFoundError('Notification not found', 'NOTIFICATION_NOT_FOUND');
  }
  return prisma.notification.update({ where: { id: notificationId }, data: { read: true } });
}

export async function markAllNotificationsRead(userId) {
  await prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } });
}