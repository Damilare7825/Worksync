import { prisma } from '../config/database.js';
import { emitToWorkspace, emitToProject } from '../sockets/emit.js';

const ACTIVITY_INCLUDE = { user: { select: { id: true, name: true, avatar: true } } };

/**
 * Fire-and-forget activity logging used by other services. `metadata`
 * should stay small and non-sensitive (ids, titles, old/new values) — never
 * tokens, password hashes, or full record dumps.
 *
 * This is the single choke point every activity-producing action goes
 * through, so it's also the single place real-time activity broadcasting
 * lives — every caller (tasks, comments, future features) gets a live
 * `activity.created` event for free without emitting it individually.
 * Broadcast to the workspace room always (workspace-level activity feeds),
 * and additionally to the project room when the entry is project-scoped
 * (so a project-detail view doesn't need to join the whole workspace).
 *
 * `entityType`/`entityId`/`entityLabel` are an optional denormalized
 * snapshot of what the event is about (e.g. entityType: 'TASK', entityId:
 * task.id, entityLabel: task.title). Pass them for events tied to a
 * specific record so the entry stays legible even after that record is
 * deleted (projectId/taskId are SET NULL on delete, but this snapshot
 * isn't). `isAudit` marks security/permission-sensitive events (role
 * changes, ownership transfer, invitations) so audit views can filter to
 * just those.
 */
export async function logActivity({
  workspaceId,
  projectId = null,
  taskId = null,
  userId,
  action,
  metadata,
  entityType = null,
  entityId = null,
  entityLabel = null,
  isAudit = false,
}) {
  const entry = await prisma.activityLog.create({
    data: {
      workspaceId,
      projectId,
      taskId,
      userId,
      action,
      metadata,
      entityType,
      entityId,
      entityLabel,
      isAudit,
    },
    // Same shape as listWorkspaceActivity/listProjectActivity/listTaskActivity,
    // so a live-arriving entry can be rendered identically to one loaded
    // from the initial fetch without an extra round trip.
    include: ACTIVITY_INCLUDE,
  });

  emitToWorkspace(workspaceId, 'activity.created', { activity: entry });
  if (projectId) {
    emitToProject(projectId, 'activity.created', { activity: entry });
  }

  return entry;
}

/**
 * Shared filter-building for the list* functions below. All optional:
 * - actorId: only events performed by this user
 * - action: exact action/event-type match (e.g. 'TASK_STATUS_CHANGED')
 * - isAudit: restrict to (or exclude) audit-flagged events
 * - dateFrom/dateTo: inclusive createdAt range
 */
function buildDateAndCommonFilters({ actorId, action, isAudit, dateFrom, dateTo } = {}) {
  const where = {};
  if (actorId) where.userId = actorId;
  if (action) where.action = action;
  if (isAudit !== undefined) where.isAudit = isAudit;
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = dateFrom;
    if (dateTo) where.createdAt.lte = dateTo;
  }
  return where;
}

export async function listWorkspaceActivity(workspaceId, { skip, take }, filters = {}) {
  const where = { workspaceId, ...buildDateAndCommonFilters(filters) };
  const [items, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: ACTIVITY_INCLUDE,
    }),
    prisma.activityLog.count({ where }),
  ]);
  return { items, total };
}

export async function listProjectActivity(projectId, { skip, take }, filters = {}) {
  const where = { projectId, ...buildDateAndCommonFilters(filters) };
  const [items, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: ACTIVITY_INCLUDE,
    }),
    prisma.activityLog.count({ where }),
  ]);
  return { items, total };
}

/**
 * Entity/task history: every event tied to a single task, most recent
 * first. Matches on the live `taskId` FK (covers the common case) as well
 * as the denormalized `entityType`/`entityId` snapshot, so history
 * survives requests made after the task itself has been deleted.
 */
export async function listTaskActivity(taskId, { skip, take }, filters = {}) {
  const common = buildDateAndCommonFilters(filters);
  const where = {
    ...common,
    OR: [{ taskId }, { entityType: 'TASK', entityId: taskId }],
  };
  const [items, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: ACTIVITY_INCLUDE,
    }),
    prisma.activityLog.count({ where }),
  ]);
  return { items, total };
}
