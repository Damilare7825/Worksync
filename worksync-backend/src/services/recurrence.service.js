import { prisma } from '../config/database.js';
import { NotFoundError } from '../utils/errors.js';
import { assertProjectManage, assertProjectAccess } from './authorization.service.js';
import { logActivity } from './activity.service.js';
import { emitToProject } from '../sockets/emit.js';

async function getTaskOr404(taskId) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new NotFoundError('Task not found', 'TASK_NOT_FOUND');
  return task;
}

/**
 * Pure date math — deliberately has no knowledge of any job runner/cron.
 * Given a timestamp and a pattern/interval, returns the next occurrence.
 * Interval is "every N units" (interval=2, pattern=WEEKLY -> every 2
 * weeks). Timezone is stored on the rule for a future scheduler to honor
 * when deciding *when in the day* to fire, but the date arithmetic itself
 * is UTC-based here to keep this deterministic and testable without a
 * timezone library dependency.
 */
export function computeNextOccurrence(from, pattern, interval = 1) {
  const next = new Date(from);
  switch (pattern) {
    case 'DAILY':
      next.setUTCDate(next.getUTCDate() + interval);
      break;
    case 'WEEKLY':
      next.setUTCDate(next.getUTCDate() + interval * 7);
      break;
    case 'MONTHLY':
      next.setUTCMonth(next.getUTCMonth() + interval);
      break;
    default:
      throw new Error(`Unknown recurrence pattern: ${pattern}`);
  }
  return next;
}

export async function setRecurrence(userId, taskId, { pattern, interval = 1, timezone = 'UTC' }) {
  const task = await getTaskOr404(taskId);
  const { project } = await assertProjectManage(userId, task.projectId);

  const nextRunAt = computeNextOccurrence(task.dueDate || new Date(), pattern, interval);

  const rule = await prisma.recurrenceRule.upsert({
    where: { taskId },
    update: { pattern, interval, timezone, nextRunAt, active: true },
    create: { taskId, pattern, interval, timezone, nextRunAt },
  });

  await logActivity({
    workspaceId: project.workspaceId,
    projectId: task.projectId,
    taskId,
    userId,
    action: 'TASK_RECURRENCE_SET',
    metadata: { pattern, interval },
    entityType: 'TASK',
    entityId: taskId,
    entityLabel: task.title,
  });
  return rule;
}

export async function removeRecurrence(userId, taskId) {
  const task = await getTaskOr404(taskId);
  const { project } = await assertProjectManage(userId, task.projectId);

  const existing = await prisma.recurrenceRule.findUnique({ where: { taskId } });
  if (!existing) return;

  await prisma.recurrenceRule.delete({ where: { taskId } });
  await logActivity({
    workspaceId: project.workspaceId,
    projectId: task.projectId,
    taskId,
    userId,
    action: 'TASK_RECURRENCE_REMOVED',
    metadata: {},
    entityType: 'TASK',
    entityId: taskId,
    entityLabel: task.title,
  });
}

export async function getRecurrence(userId, taskId) {
  const task = await getTaskOr404(taskId);
  await assertProjectAccess(userId, task.projectId);
  return prisma.recurrenceRule.findUnique({ where: { taskId } });
}

/**
 * Generates the next occurrence for one rule if it's actually due
 * (nextRunAt <= now), copying the template task's core fields into a
 * fresh Task and advancing nextRunAt so the same occurrence is never
 * generated twice — this is what makes the backend "authoritative": the
 * uniqueness guarantee lives in nextRunAt only moving forward after a
 * successful generation, not in any client-side timer.
 *
 * Deliberately just a plain async function, not wired to setInterval/cron
 * anywhere — invoking it on a schedule is later-phase job infrastructure's
 * job. It's exposed here, and via a manual POST endpoint, so it can be
 * called by a scheduler once one exists, or triggered by hand today.
 */
export async function generateOccurrenceIfDue(ruleId, { now = new Date() } = {}) {
  const rule = await prisma.recurrenceRule.findUnique({ where: { id: ruleId }, include: { task: true } });
  if (!rule || !rule.active) return null;
  if (rule.nextRunAt > now) return null;

  const template = rule.task;
  const newTask = await prisma.task.create({
    data: {
      projectId: template.projectId,
      creatorId: template.creatorId,
      assigneeId: template.assigneeId,
      title: template.title,
      description: template.description,
      priority: template.priority,
      dueDate: rule.nextRunAt,
      generatedFromRuleId: rule.id,
    },
  });

  const nextRunAt = computeNextOccurrence(rule.nextRunAt, rule.pattern, rule.interval);
  await prisma.recurrenceRule.update({ where: { id: rule.id }, data: { nextRunAt } });

  await logActivity({
    workspaceId: (await prisma.project.findUnique({ where: { id: template.projectId } })).workspaceId,
    projectId: template.projectId,
    taskId: newTask.id,
    userId: template.creatorId,
    action: 'TASK_CREATED',
    metadata: { title: newTask.title, generatedFromRuleId: rule.id },
    entityType: 'TASK',
    entityId: newTask.id,
    entityLabel: newTask.title,
  });
  emitToProject(template.projectId, 'task.created', { task: newTask });

  return newTask;
}

/** Scans every active, due rule and generates their occurrence. Same
 * "ready for a scheduler, isn't one itself" caveat as above. */
export async function generateAllDueOccurrences(now = new Date()) {
  const dueRules = await prisma.recurrenceRule.findMany({ where: { active: true, nextRunAt: { lte: now } } });
  const generated = [];
  for (const rule of dueRules) {
    const task = await generateOccurrenceIfDue(rule.id, { now });
    if (task) generated.push(task);
  }
  return generated;
}
