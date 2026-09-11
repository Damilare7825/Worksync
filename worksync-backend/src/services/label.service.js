import { prisma } from '../config/database.js';
import { ConflictError, NotFoundError } from '../utils/errors.js';
import { assertWorkspaceMembership, assertProjectManage } from './authorization.service.js';
import { logActivity } from './activity.service.js';
import { emitToProject } from '../sockets/emit.js';

// Any workspace member can create/use labels — they're shared, low-stakes
// organizational metadata (not a security boundary), so requiring
// OWNER/ADMIN would just create friction for everyday tagging.
export async function listLabels(userId, workspaceId) {
  await assertWorkspaceMembership(userId, workspaceId);
  return prisma.label.findMany({ where: { workspaceId }, orderBy: { name: 'asc' } });
}

export async function createLabel(userId, workspaceId, { name, color }) {
  await assertWorkspaceMembership(userId, workspaceId);
  const existing = await prisma.label.findUnique({
    where: { workspaceId_name: { workspaceId, name } },
  });
  if (existing) {
    throw new ConflictError(`A label named "${name}" already exists in this workspace`, 'LABEL_ALREADY_EXISTS');
  }
  return prisma.label.create({ data: { workspaceId, name, color } });
}

export async function deleteLabel(userId, workspaceId, labelId) {
  await assertWorkspaceMembership(userId, workspaceId);
  const label = await prisma.label.findUnique({ where: { id: labelId } });
  if (!label || label.workspaceId !== workspaceId) {
    throw new NotFoundError('Label not found', 'LABEL_NOT_FOUND');
  }
  // TaskLabel rows cascade automatically — removing a label just untags
  // every task that had it, it doesn't touch the tasks themselves.
  await prisma.label.delete({ where: { id: labelId } });
}

async function getTaskOr404(taskId) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new NotFoundError('Task not found', 'TASK_NOT_FOUND');
  return task;
}

export async function addLabelToTask(userId, taskId, labelId) {
  const task = await getTaskOr404(taskId);
  const { project } = await assertProjectManage(userId, task.projectId);

  const label = await prisma.label.findUnique({ where: { id: labelId } });
  if (!label || label.workspaceId !== project.workspaceId) {
    throw new NotFoundError('Label not found in this workspace', 'LABEL_NOT_FOUND');
  }

  const existing = await prisma.taskLabel.findUnique({ where: { taskId_labelId: { taskId, labelId } } });
  if (existing) return existing;

  const link = await prisma.taskLabel.create({ data: { taskId, labelId } });
  await logActivity({
    workspaceId: project.workspaceId,
    projectId: task.projectId,
    taskId,
    userId,
    action: 'LABEL_ADDED',
    metadata: { labelId, labelName: label.name },
    entityType: 'TASK',
    entityId: taskId,
    entityLabel: task.title,
  });
  emitToProject(task.projectId, 'task.label.changed', { taskId, actorId: userId });
  return link;
}

export async function removeLabelFromTask(userId, taskId, labelId) {
  const task = await getTaskOr404(taskId);
  const { project } = await assertProjectManage(userId, task.projectId);

  const existing = await prisma.taskLabel.findUnique({ where: { taskId_labelId: { taskId, labelId } } });
  if (!existing) return;

  const label = await prisma.label.findUnique({ where: { id: labelId } });
  await prisma.taskLabel.delete({ where: { taskId_labelId: { taskId, labelId } } });
  await logActivity({
    workspaceId: project.workspaceId,
    projectId: task.projectId,
    taskId,
    userId,
    action: 'LABEL_REMOVED',
    metadata: { labelId, labelName: label?.name },
    entityType: 'TASK',
    entityId: taskId,
    entityLabel: task.title,
  });
  emitToProject(task.projectId, 'task.label.changed', { taskId, actorId: userId });
}
