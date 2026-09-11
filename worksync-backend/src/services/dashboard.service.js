import { prisma } from '../config/database.js';

/**
 * All statistics are computed live from PostgreSQL for the tasks the
 * authenticated user is assigned to (across every project they belong to).
 */
export async function getDashboardStats(userId) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
  const sevenDaysOut = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Archived projects are read-only history, not part of "what should I
  // work on" — excluded from every dashboard stat below so an archived
  // project's leftover tasks don't inflate someone's active workload.
  const baseWhere = { assigneeId: userId, project: { status: { not: 'ARCHIVED' } } };

  const [
    totalTasks,
    todo,
    inProgress,
    completed,
    overdue,
    dueToday,
    upcoming,
    recentlyCompleted,
    byPriorityRaw,
  ] = await Promise.all([
    prisma.task.count({ where: baseWhere }),
    prisma.task.count({ where: { ...baseWhere, status: 'TODO' } }),
    prisma.task.count({ where: { ...baseWhere, status: 'IN_PROGRESS' } }),
    prisma.task.count({ where: { ...baseWhere, status: 'COMPLETED' } }),
    prisma.task.count({
      where: { ...baseWhere, status: { not: 'COMPLETED' }, dueDate: { lt: startOfToday } },
    }),
    prisma.task.findMany({
      where: { ...baseWhere, status: { not: 'COMPLETED' }, dueDate: { gte: startOfToday, lt: endOfToday } },
      orderBy: { dueDate: 'asc' },
    }),
    prisma.task.findMany({
      where: { ...baseWhere, status: { not: 'COMPLETED' }, dueDate: { gte: endOfToday, lt: sevenDaysOut } },
      orderBy: { dueDate: 'asc' },
      take: 10,
    }),
    prisma.task.findMany({
      where: { ...baseWhere, status: 'COMPLETED' },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    }),
    prisma.task.groupBy({
      by: ['priority'],
      where: baseWhere,
      _count: { _all: true },
    }),
  ]);

  const tasksByPriority = { LOW: 0, MEDIUM: 0, HIGH: 0, URGENT: 0 };
  for (const row of byPriorityRaw) {
    tasksByPriority[row.priority] = row._count._all;
  }

  return {
    totalTasks,
    todo,
    inProgress,
    completed,
    overdue,
    dueToday,
    upcomingTasks: upcoming,
    recentlyCompleted,
    tasksByPriority,
  };
}
