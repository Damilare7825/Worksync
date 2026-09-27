import { Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';
import { assertProjectAccess, assertWorkspaceMembership, isWorkspaceAdminOrOwner } from './authorization.service.js';

const EMPTY_STATUS = Object.fromEntries(['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED'].map((status) => [status, 0]));
const EMPTY_PRIORITY = Object.fromEntries(['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((priority) => [priority, 0]));

function startOfToday() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function normalizeRange({ dateFrom, dateTo } = {}) {
  const end = dateTo ? new Date(dateTo) : new Date();
  const start = dateFrom ? new Date(dateFrom) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { start, end: new Date(end.getTime() + 24 * 60 * 60 * 1000) };
}

async function getVisibleProjectIds(userId, workspaceId) {
  const membership = await assertWorkspaceMembership(userId, workspaceId);
  if (isWorkspaceAdminOrOwner(membership.role)) {
    const projects = await prisma.project.findMany({ where: { workspaceId }, select: { id: true } });
    return projects.map((project) => project.id);
  }

  const memberships = await prisma.projectMember.findMany({
    where: { userId, project: { workspaceId } },
    select: { projectId: true },
  });
  return memberships.map((projectMembership) => projectMembership.projectId);
}

async function getCompletionTrend(projectIds, range) {
  // Temporarily disable raw query to test if this is the source of the error
  return [];
}

async function buildTaskAnalytics(projectIds, range) {
  if (projectIds.length === 0) {
    return {
      summary: { totalTasks: 0, completedTasks: 0, incompleteTasks: 0, overdueTasks: 0, completionRate: null },
      distributions: { status: { ...EMPTY_STATUS }, priority: { ...EMPTY_PRIORITY } },
      workload: [],
      deadlines: { dueToday: 0, upcoming: 0, overdue: 0 },
      completionTrend: [],
    };
  }

  const projectFilter = { in: projectIds };
  const today = startOfToday();
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const activeWhere = { projectId: projectFilter, status: { not: 'COMPLETED' } };

  const [totalTasks, completedTasks, overdueTasks, dueToday, upcoming, statusRows, priorityRows, workloadRows, completionTrend] = await Promise.all([
    prisma.task.count({ where: { projectId: projectFilter } }),
    prisma.task.count({ where: { projectId: projectFilter, status: 'COMPLETED' } }),
    prisma.task.count({ where: { ...activeWhere, dueDate: { lt: today } } }),
    prisma.task.count({ where: { ...activeWhere, dueDate: { gte: today, lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) } } }),
    prisma.task.count({ where: { ...activeWhere, dueDate: { gte: today, lt: nextWeek } } }),
    prisma.task.groupBy({ by: ['status'], where: { projectId: projectFilter }, _count: { _all: true } }),
    prisma.task.groupBy({ by: ['priority'], where: { projectId: projectFilter }, _count: { _all: true } }),
    prisma.task.groupBy({ by: ['assigneeId'], where: { projectId: projectFilter, assigneeId: { not: null } }, _count: { _all: true } }),
    getCompletionTrend(projectIds, range),
  ]);

  const assigneeIds = workloadRows.map((row) => row.assigneeId).filter(Boolean);
  const users = assigneeIds.length
    ? await prisma.user.findMany({ where: { id: { in: assigneeIds } }, select: { id: true, name: true, avatar: true } })
    : [];
  const usersById = new Map(users.map((user) => [user.id, user]));
  const status = { ...EMPTY_STATUS };
  const priority = { ...EMPTY_PRIORITY };
  statusRows.forEach((row) => { status[row.status] = row._count._all; });
  priorityRows.forEach((row) => { priority[row.priority] = row._count._all; });

  return {
    summary: {
      totalTasks,
      completedTasks,
      incompleteTasks: totalTasks - completedTasks,
      overdueTasks,
      completionRate: totalTasks ? Math.round((completedTasks / totalTasks) * 100) : null,
    },
    distributions: { status, priority },
    workload: workloadRows.map((row) => ({
      user: usersById.get(row.assigneeId) || { id: row.assigneeId, name: 'Unknown member', avatar: null },
      taskCount: row._count._all,
    })).sort((a, b) => b.taskCount - a.taskCount),
    deadlines: { dueToday, upcoming, overdue: overdueTasks },
    completionTrend,
  };
}

export async function getWorkspaceAnalytics(userId, workspaceId, dateRange) {
  const projectIds = await getVisibleProjectIds(userId, workspaceId);
  const activityWhere = {
    workspaceId,
    ...(projectIds.length
      ? { OR: [{ projectId: null }, { projectId: { in: projectIds } }] }
      : { projectId: null }),
  };
  const [analytics, projectRows, activity] = await Promise.all([
    buildTaskAnalytics(projectIds, normalizeRange(dateRange)),
    prisma.project.groupBy({ by: ['status'], where: { id: { in: projectIds } }, _count: { _all: true } }),
    prisma.activityLog.findMany({
      where: activityWhere,
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, action: true, createdAt: true, entityLabel: true, projectId: true },
    }),
  ]);
  const projects = { ACTIVE: 0, COMPLETED: 0, ARCHIVED: 0 };
  projectRows.forEach((row) => { projects[row.status] = row._count._all; });
  return { workspaceId, projects, activity, ...analytics };
}

export async function getProjectAnalytics(userId, projectId, dateRange) {
  const { project } = await assertProjectAccess(userId, projectId);
  return { projectId, projectName: project.name, ...await buildTaskAnalytics([projectId], normalizeRange(dateRange)) };
}

export async function getPersonalAnalytics(userId, workspaceId, dateRange) {
  const projectIds = await getVisibleProjectIds(userId, workspaceId);
  const analytics = await buildTaskAnalytics(projectIds, normalizeRange(dateRange));
  const assignedWhere = { projectId: { in: projectIds }, assigneeId: userId };
  const [assignedTasks, watchedTasks, recentActivity] = await Promise.all([
    prisma.task.count({ where: assignedWhere }),
    prisma.taskWatcher.count({ where: { userId, task: { projectId: { in: projectIds } } } }),
    prisma.activityLog.findMany({ where: { workspaceId, userId }, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, action: true, createdAt: true, entityLabel: true } }),
  ]);
  return { workspaceId, assignedTasks, watchedTasks, recentActivity, ...analytics };
}
