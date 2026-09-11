import { prisma } from '../config/database.js';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors.js';
import { assertProjectAccess, assertProjectManage } from './authorization.service.js';
import { logActivity } from './activity.service.js';
import { emitToProject } from '../sockets/emit.js';

async function getTaskOr404(taskId) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new NotFoundError('Task not found', 'TASK_NOT_FOUND');
  return task;
}

// Checklist edits follow the same two-tier permission as task updates:
// project managers/admins can fully manage the checklist, and the task's
// own assignee can at least tick items off (mirrors being allowed to
// change task status but not the rest of the task).
async function assertCanEditChecklist(userId, task) {
  try {
    return await assertProjectManage(userId, task.projectId);
  } catch (err) {
    if (!(err instanceof ForbiddenError)) throw err;
    const context = await assertProjectAccess(userId, task.projectId);
    if (task.assigneeId !== userId) {
      throw new ForbiddenError('You do not have permission to edit this checklist', 'FORBIDDEN');
    }
    return context;
  }
}

export async function listItems(userId, taskId) {
  const task = await getTaskOr404(taskId);
  await assertProjectAccess(userId, task.projectId);
  return prisma.checklistItem.findMany({ where: { taskId }, orderBy: { position: 'asc' } });
}

export async function addItem(userId, taskId, { text }) {
  const task = await getTaskOr404(taskId);
  const { project } = await assertCanEditChecklist(userId, task);

  const count = await prisma.checklistItem.count({ where: { taskId } });
  const item = await prisma.checklistItem.create({
    data: { taskId, text, position: count },
  });

  await logActivity({
    workspaceId: project.workspaceId,
    projectId: task.projectId,
    taskId,
    userId,
    action: 'CHECKLIST_ITEM_ADDED',
    metadata: { text },
    entityType: 'TASK',
    entityId: taskId,
    entityLabel: task.title,
  });
  emitToProject(task.projectId, 'checklist.updated', { taskId, actorId: userId });
  return item;
}

async function getItemOr404(itemId) {
  const item = await prisma.checklistItem.findUnique({ where: { id: itemId } });
  if (!item) throw new NotFoundError('Checklist item not found', 'CHECKLIST_ITEM_NOT_FOUND');
  return item;
}

export async function updateItem(userId, itemId, data) {
  const item = await getItemOr404(itemId);
  const task = await getTaskOr404(item.taskId);
  const { project } = await assertCanEditChecklist(userId, task);

  const wasCompleted = item.completed;
  const updated = await prisma.checklistItem.update({ where: { id: itemId }, data });

  // Only log a completion toggle (meaningful history) — editing the text
  // of an item is common enough busywork that it isn't worth an activity
  // entry per keystroke/save, matching the "avoid noise" guidance.
  if (data.completed !== undefined && data.completed !== wasCompleted) {
    await logActivity({
      workspaceId: project.workspaceId,
      projectId: task.projectId,
      taskId: item.taskId,
      userId,
      action: data.completed ? 'CHECKLIST_ITEM_COMPLETED' : 'CHECKLIST_ITEM_REOPENED',
      metadata: { text: updated.text },
      entityType: 'TASK',
      entityId: item.taskId,
      entityLabel: task.title,
    });
  }
  emitToProject(task.projectId, 'checklist.updated', { taskId: item.taskId, actorId: userId });
  return updated;
}

export async function deleteItem(userId, itemId) {
  const item = await getItemOr404(itemId);
  const task = await getTaskOr404(item.taskId);
  const { project } = await assertCanEditChecklist(userId, task);

  await prisma.checklistItem.delete({ where: { id: itemId } });
  await logActivity({
    workspaceId: project.workspaceId,
    projectId: task.projectId,
    taskId: item.taskId,
    userId,
    action: 'CHECKLIST_ITEM_DELETED',
    metadata: { text: item.text },
    entityType: 'TASK',
    entityId: item.taskId,
    entityLabel: task.title,
  });
  emitToProject(task.projectId, 'checklist.updated', { taskId: item.taskId, actorId: userId });
}

/**
 * Reorders every item in one shot (the client sends the full ordered id
 * list after a drag-and-drop). Not activity-logged — reordering isn't
 * meaningful history, it's UI housekeeping.
 */
export async function reorderItems(userId, taskId, orderedItemIds) {
  const task = await getTaskOr404(taskId);
  await assertCanEditChecklist(userId, task);

  const existing = await prisma.checklistItem.findMany({ where: { taskId } });
  const existingIds = new Set(existing.map((i) => i.id));
  if (orderedItemIds.length !== existing.length || !orderedItemIds.every((id) => existingIds.has(id))) {
    throw new ValidationError('Reorder list must contain exactly this task\u2019s checklist items');
  }

  await Promise.all(
    orderedItemIds.map((itemId, position) => prisma.checklistItem.update({ where: { id: itemId }, data: { position } }))
  );
  emitToProject(task.projectId, 'checklist.updated', { taskId, actorId: userId });
  return prisma.checklistItem.findMany({ where: { taskId }, orderBy: { position: 'asc' } });
}
