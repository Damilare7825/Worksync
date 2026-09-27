import { prisma } from '../config/database.js';
import { appCache } from '../utils/cache.js';

const DASHBOARD_CACHE_TTL_SECONDS = 15;

export const DASHBOARD_TASK_SELECT = {
  id: true,
  title: true,
  status: true,
  priority: true,
  dueDate: true,
  projectId: true,
  updatedAt: true,
  createdAt: true,
  project: {
    select: {
      id: true,
      name: true,
      workspaceId: true,
    },
  },
};

export function invalidateDashboardCache(userId = null) {
  if (userId) {
    appCache.del(`dashboard:stats:${userId}`);
  } else {
    appCache.delByPrefix('dashboard:stats:');
  }
}

/**
 * All statistics are computed for the tasks the authenticated user is assigned to.
 * Consolidated into efficient groupBy queries and selective projections,
 * with short-lived in-memory caching to eliminate redundant database load.
 */
export async function getDashboardStats(userId) {
  const cacheKey = `dashboard:stats:${userId}`;

  return appCache.wrap(cacheKey, DASHBOARD_CACHE_TTL_SECONDS, async () => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
    const sevenDaysOut = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Archived projects are read-only history — excluded from dashboard
    const baseWhere = { assigneeId: userId, project: { status: { not: 'ARCHIVED' } } };

    // Consolidated execution: 2 groupBy aggregations + 1 count + 3 selective findMany queries
    const [
      byStatusRaw,
      overdue,
      dueToday,
      upcoming,
      recentlyCompleted,
      byPriorityRaw,
    ] = await Promise.all([
      prisma.task.groupBy({
        by: ['status'],
        where: baseWhere,
        _count: { _all: true },
      }),
      prisma.task.count({
        where: { ...baseWhere, status: { not: 'COMPLETED' }, dueDate: { lt: startOfToday } },
      }),
      prisma.task.findMany({
        where: { ...baseWhere, status: { not: 'COMPLETED' }, dueDate: { gte: startOfToday, lt: endOfToday } },
        orderBy: { dueDate: 'asc' },
        select: DASHBOARD_TASK_SELECT,
      }),
      prisma.task.findMany({
        where: { ...baseWhere, status: { not: 'COMPLETED' }, dueDate: { gte: endOfToday, lt: sevenDaysOut } },
        orderBy: { dueDate: 'asc' },
        take: 10,
        select: DASHBOARD_TASK_SELECT,
      }),
      prisma.task.findMany({
        where: { ...baseWhere, status: 'COMPLETED' },
        orderBy: { updatedAt: 'desc' },
        take: 10,
        select: DASHBOARD_TASK_SELECT,
      }),
      prisma.task.groupBy({
        by: ['priority'],
        where: baseWhere,
        _count: { _all: true },
      }),
    ]);

    const statusCounts = { TODO: 0, IN_PROGRESS: 0, COMPLETED: 0, IN_REVIEW: 0, BACKLOG: 0 };
    let totalTasks = 0;
    for (const row of byStatusRaw) {
      statusCounts[row.status] = row._count._all;
      totalTasks += row._count._all;
    }

    const tasksByPriority = { LOW: 0, MEDIUM: 0, HIGH: 0, URGENT: 0 };
    for (const row of byPriorityRaw) {
      tasksByPriority[row.priority] = row._count._all;
    }

    return {
      totalTasks,
      todo: statusCounts.TODO || 0,
      inProgress: statusCounts.IN_PROGRESS || 0,
      completed: statusCounts.COMPLETED || 0,
      overdue,
      dueToday,
      upcomingTasks: upcoming,
      recentlyCompleted,
      tasksByPriority,
    };
  });
}
