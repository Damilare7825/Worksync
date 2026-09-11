import { prisma } from '../config/database.js';
import { NotFoundError } from '../utils/errors.js';
import { assertProjectAccess } from './authorization.service.js';
import { emitToProject } from '../sockets/emit.js';

async function getTaskOr404(taskId) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new NotFoundError('Task not found', 'TASK_NOT_FOUND');
  return task;
}

/**
 * Watching is self-service — anyone with read access to the task can
 * subscribe, no manager permission required. Not activity-logged: it's a
 * personal notification preference, not a fact about the task's own
 * history that other people would care to see. It still integrates with
 * the existing notification system (see notifyWatchers below, called by
 * task/comment services), so it isn't a second notification engine.
 */
export async function watchTask(userId, taskId) {
  const task = await getTaskOr404(taskId);
  await assertProjectAccess(userId, task.projectId);

  const existing = await prisma.taskWatcher.findUnique({ where: { taskId_userId: { taskId, userId } } });
  if (existing) return existing;

  const watcher = await prisma.taskWatcher.create({ data: { taskId, userId } });
  emitToProject(task.projectId, 'task.watchers.changed', { taskId, actorId: userId });
  return watcher;
}

export async function unwatchTask(userId, taskId) {
  const task = await getTaskOr404(taskId);
  await assertProjectAccess(userId, task.projectId);

  const existing = await prisma.taskWatcher.findUnique({ where: { taskId_userId: { taskId, userId } } });
  if (!existing) return;

  await prisma.taskWatcher.delete({ where: { taskId_userId: { taskId, userId } } });
  emitToProject(task.projectId, 'task.watchers.changed', { taskId, actorId: userId });
}

export async function listWatchers(userId, taskId) {
  const task = await getTaskOr404(taskId);
  await assertProjectAccess(userId, task.projectId);
  return prisma.taskWatcher.findMany({
    where: { taskId },
    include: { user: { select: { id: true, name: true, avatar: true } } },
  });
}

/**
 * Notifies every watcher of a task about some event (excluding the actor
 * who caused it), reusing the existing Notification model/service rather
 * than building a separate delivery path. Called by task/comment services
 * for events watchers should hear about (status change, new comment,
 * etc.) — kept generic so callers decide what counts as watch-worthy.
 */
export async function notifyWatchers(taskId, { excludeUserId, type = 'TASK_UPDATE', title, message }) {
  const { createNotification } = await import('./notification.service.js');
  const { getOrCreateNotificationPreferences } = await import('./user.service.js');
  const watchers = await prisma.taskWatcher.findMany({ where: { taskId } });

  // Cache notification preferences by userId to avoid repeated DB fetches
  const preferencesCache = new Map();

  await Promise.all(
    watchers
      .filter((w) => w.userId !== excludeUserId)
      .map(async (w) => {
        // Get cached preferences or fetch and cache them
        let preferences = preferencesCache.get(w.userId);
        if (!preferences) {
          preferences = await getOrCreateNotificationPreferences(w.userId);
          preferencesCache.set(w.userId, preferences);
        }
        return createNotification({ userId: w.userId, type, title, message }, preferences);
      })
  );
}
