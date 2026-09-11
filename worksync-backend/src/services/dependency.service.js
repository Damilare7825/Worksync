import { prisma } from '../config/database.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';
import { assertProjectManage } from './authorization.service.js';
import { logActivity } from './activity.service.js';
import { emitToProject } from '../sockets/emit.js';

async function getTaskOr404(taskId) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new NotFoundError('Task not found', 'TASK_NOT_FOUND');
  return task;
}

/**
 * Would adding `taskId depends on dependsOnTaskId` create a cycle? Walks
 * the dependency graph outward from the proposed dependency: if
 * dependsOnTaskId (transitively) depends on taskId, adding this edge
 * would close a loop.
 */
async function wouldCreateCycle(taskId, dependsOnTaskId) {
  const visited = new Set();
  const queue = [dependsOnTaskId];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === taskId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    const edges = await prisma.taskDependency.findMany({ where: { taskId: current } });
    queue.push(...edges.map((e) => e.dependsOnTaskId));
  }
  return false;
}

export async function addDependency(userId, taskId, dependsOnTaskId) {
  if (taskId === dependsOnTaskId) {
    throw new ForbiddenError('A task cannot depend on itself', 'SELF_DEPENDENCY');
  }
  const task = await getTaskOr404(taskId);
  const dependsOnTask = await getTaskOr404(dependsOnTaskId);
  if (task.projectId !== dependsOnTask.projectId) {
    throw new ForbiddenError('Dependencies must be within the same project', 'CROSS_PROJECT_DEPENDENCY');
  }
  const { project } = await assertProjectManage(userId, task.projectId);

  const existing = await prisma.taskDependency.findUnique({
    where: { taskId_dependsOnTaskId: { taskId, dependsOnTaskId } },
  });
  if (existing) return existing;

  if (await wouldCreateCycle(taskId, dependsOnTaskId)) {
    throw new ForbiddenError('This would create a circular dependency', 'CIRCULAR_DEPENDENCY');
  }

  const dependency = await prisma.taskDependency.create({ data: { taskId, dependsOnTaskId } });
  await logActivity({
    workspaceId: project.workspaceId,
    projectId: task.projectId,
    taskId,
    userId,
    action: 'DEPENDENCY_ADDED',
    metadata: { dependsOnTaskId, dependsOnTaskTitle: dependsOnTask.title },
    entityType: 'TASK',
    entityId: taskId,
    entityLabel: task.title,
  });
  emitToProject(task.projectId, 'task.dependency.changed', { taskId, actorId: userId });
  return dependency;
}

export async function removeDependency(userId, taskId, dependsOnTaskId) {
  const task = await getTaskOr404(taskId);
  const { project } = await assertProjectManage(userId, task.projectId);

  const existing = await prisma.taskDependency.findUnique({
    where: { taskId_dependsOnTaskId: { taskId, dependsOnTaskId } },
  });
  if (!existing) return;

  await prisma.taskDependency.delete({ where: { taskId_dependsOnTaskId: { taskId, dependsOnTaskId } } });
  await logActivity({
    workspaceId: project.workspaceId,
    projectId: task.projectId,
    taskId,
    userId,
    action: 'DEPENDENCY_REMOVED',
    metadata: { dependsOnTaskId },
    entityType: 'TASK',
    entityId: taskId,
    entityLabel: task.title,
  });
  emitToProject(task.projectId, 'task.dependency.changed', { taskId, actorId: userId });
}
