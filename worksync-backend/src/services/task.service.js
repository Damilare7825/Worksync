import { prisma } from '../config/database.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/errors.js';
import { assertProjectAccess, assertProjectManage, isWorkspaceAdminOrOwner, getWorkspaceMembership } from './authorization.service.js';
import { logActivity } from './activity.service.js';
import { createNotification } from './notification.service.js';
import { emitToProject } from '../sockets/emit.js';
import { addLabelToTask, removeLabelFromTask } from './label.service.js';

async function assertTaskAssigneeIsProjectMember(projectId, assigneeId) {
  if (!assigneeId) return;
  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: assigneeId } },
  });
  if (!membership) {
    throw new NotFoundError('Assignee is not a member of this project', 'ASSIGNEE_NOT_PROJECT_MEMBER');
  }
}

async function nextPosition(projectId, status, parentTaskId = null) {
  const last = await prisma.task.findMany({
    where: { projectId, status, parentTaskId },
    orderBy: { position: 'desc' },
    take: 1,
    select: { position: true },
  });
  return (last[0]?.position ?? -1) + 1;
}

async function reindexColumn(projectId, status, parentTaskId, orderedIds) {
  await prisma.$transaction(
    orderedIds.map((id, position) => prisma.task.update({ where: { id }, data: { position } }))
  );
}

const TASK_SORT_FIELDS = new Set(['createdAt', 'updatedAt', 'dueDate', 'title', 'position', 'priority', 'status']);

const ASSIGNEE_ALLOWED_FIELDS = new Set(['status']);

// Creating, fully editing, and deleting tasks is a Project Manager (or
// workspace OWNER/ADMIN) action per the spec's permission tables.
export async function createTask(userId, projectId, data) {
  const { project } = await assertProjectManage(userId, projectId);
  if (project.status === 'ARCHIVED') {
    throw new ForbiddenError(
      'This project is archived — restore it before adding new tasks',
      'PROJECT_ARCHIVED'
    );
  }
  await assertTaskAssigneeIsProjectMember(projectId, data.assigneeId);

  if (data.parentTaskId) {
    const parent = await prisma.task.findUnique({ where: { id: data.parentTaskId } });
    if (!parent || parent.projectId !== projectId) {
      throw new NotFoundError('Parent task not found in this project', 'PARENT_TASK_NOT_FOUND');
    }
  }

  const status = 'TODO';
  const position = await nextPosition(projectId, status, data.parentTaskId || null);

  const task = await prisma.task.create({
    data: { ...data, projectId, creatorId: userId, position },
  });

  await logActivity({
    workspaceId: project.workspaceId,
    projectId,
    taskId: task.id,
    userId,
    action: data.parentTaskId ? 'SUBTASK_CREATED' : 'TASK_CREATED',
    metadata: data.parentTaskId ? { title: task.title, parentTaskId: data.parentTaskId } : { title: task.title },
    entityType: 'TASK',
    entityId: task.id,
    entityLabel: task.title,
  });
  if (data.parentTaskId) {
    // Also record the event against the parent's own history — someone
    // reading the parent task's timeline should see "a subtask was added"
    // without having to already know the child task's id.
    await logActivity({
      workspaceId: project.workspaceId,
      projectId,
      taskId: data.parentTaskId,
      userId,
      action: 'SUBTASK_CREATED',
      metadata: { subtaskId: task.id, title: task.title },
      entityType: 'TASK',
      entityId: data.parentTaskId,
    });
  }

  if (task.assigneeId && task.assigneeId !== userId) {
    await createNotification({
      userId: task.assigneeId,
      type: 'TASK_ASSIGNED',
      title: 'New task assigned',
      message: `You were assigned "${task.title}"`,
    });
    await logActivity({
      workspaceId: project.workspaceId,
      projectId,
      taskId: task.id,
      userId,
      action: 'TASK_ASSIGNED',
      metadata: { assigneeId: task.assigneeId },
      entityType: 'TASK',
      entityId: task.id,
      entityLabel: task.title,
    });
  }

  emitToProject(projectId, 'task.created', { task, actorId: userId });

  return task;
}

export async function listTasks(userId, projectId, filters, { skip, take }, { lightweight = false } = {}) {
  await assertProjectAccess(userId, projectId);

  const where = {
    projectId,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.priority ? { priority: filters.priority } : {}),
    ...(filters.assigneeId ? { assigneeId: filters.assigneeId } : {}),
    ...(filters.dueFrom || filters.dueTo
      ? { dueDate: { ...(filters.dueFrom ? { gte: filters.dueFrom } : {}), ...(filters.dueTo ? { lte: filters.dueTo } : {}) } }
      : {}),
    // Subtasks are hidden from the main project task list by default (they
    // show up nested under their parent instead, via getTask) so boards/
    // lists aren't cluttered — pass includeSubtasks=true to get everything.
    ...(filters.includeSubtasks === true ? {} : { parentTaskId: null }),
  };

  if (filters.labelId) {
    // Resolved as an explicit id-membership filter (rather than a nested
    // `labels: { some: { labelId } } }` relation filter) so this behaves
    // identically whether the where-clause is evaluated by Postgres or by
    // a simpler in-memory matcher — a relation-filter shape that only a
    // real relational engine can resolve would silently return nothing
    // in the latter case.
    const matches = await prisma.taskLabel.findMany({ where: { labelId: filters.labelId } });
    where.id = { in: matches.map((m) => m.taskId) };
  }

  const sortField = TASK_SORT_FIELDS.has(filters.sortBy) ? filters.sortBy : 'createdAt';
  const sortDir = filters.sortDir === 'asc' ? 'asc' : 'desc';
  const orderBy =
    sortField === 'position'
      ? [{ position: 'asc' }, { createdAt: 'asc' }]
      : [{ [sortField]: sortDir }, { createdAt: 'desc' }];

  const [items, total] = await Promise.all([
    prisma.task.findMany({
      where,
      skip,
      take,
      orderBy,
      include: lightweight
        ? undefined
        : {
            labels: { include: { label: true } },
            _count: { select: { subtasks: true, checklistItems: true, watchers: true } },
          },
    }),
    prisma.task.count({ where }),
  ]);

  // Attach "how many of this task's subtasks are done" alongside the
  // total count already in `_count.subtasks` — enough for a "2/3
  // subtasks" progress indicator without the client having to fetch each
  // parent's full subtask list just to count them.
  // Skip this for lightweight mode as it requires additional queries
  if (!lightweight) {
    const parentIds = items.filter((t) => (t._count?.subtasks || 0) > 0).map((t) => t.id);
    if (parentIds.length > 0) {
      const completedCounts = await prisma.task.groupBy({
        by: ['parentTaskId'],
        where: { parentTaskId: { in: parentIds }, status: 'COMPLETED' },
        _count: { _all: true },
      });
      const completedByParent = new Map(completedCounts.map((c) => [c.parentTaskId, c._count._all]));
      for (const task of items) {
        task.subtaskCompletedCount = completedByParent.get(task.id) || 0;
      }
    }
  }

  return { items, total };
}

export async function listWorkspaceTasks(userId, workspaceId, filters, { skip, take }) {
  const membership = await getWorkspaceMembership(userId, workspaceId);
  if (!membership) {
    throw new NotFoundError('Workspace not found', 'WORKSPACE_NOT_FOUND');
  }

  const isPrivileged = isWorkspaceAdminOrOwner(membership.role);
  const visibleProjectIds = isPrivileged
    ? (await prisma.project.findMany({ where: { workspaceId }, select: { id: true } })).map((p) => p.id)
    : (await prisma.projectMember.findMany({
        where: { userId, project: { workspaceId } },
        select: { projectId: true },
      })).map((p) => p.projectId);

  if (filters.projectId) {
    if (!visibleProjectIds.includes(filters.projectId)) {
      return { items: [], total: 0 };
    }
  }

  const targetProjectIds = filters.projectId ? [filters.projectId] : visibleProjectIds;

  const where = {
    projectId: { in: targetProjectIds },
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.priority ? { priority: filters.priority } : {}),
    ...(filters.assigneeId ? { assigneeId: filters.assigneeId } : {}),
    ...(filters.labelId ? { labels: { some: { labelId: filters.labelId } } } : {}),
    ...(filters.includeSubtasks ? {} : { parentTaskId: null }),
    ...((filters.dueFrom || filters.dueTo)
      ? {
          dueDate: {
            ...(filters.dueFrom ? { gte: filters.dueFrom } : {}),
            ...(filters.dueTo ? { lte: filters.dueTo } : {}),
          },
        }
      : {}),
  };

  if (filters.labelId) {
    const matches = await prisma.taskLabel.findMany({ where: { labelId: filters.labelId } });
    where.id = { in: matches.map((m) => m.taskId) };
  }

  const sortField = TASK_SORT_FIELDS.has(filters.sortBy) ? filters.sortBy : 'createdAt';
  const sortDir = filters.sortDir === 'asc' ? 'asc' : 'desc';
  const orderBy =
    sortField === 'position'
      ? [{ position: 'asc' }, { createdAt: 'asc' }]
      : [{ [sortField]: sortDir }, { createdAt: 'desc' }];

  const [items, total] = await Promise.all([
    prisma.task.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        labels: { include: { label: true } },
        _count: { select: { subtasks: true, checklistItems: true, watchers: true } },
        project: { select: { id: true, name: true, workspaceId: true } },
      },
    }),
    prisma.task.count({ where }),
  ]);

  if (filters.includeSubtasks !== true) {
    const parentIds = items.filter((t) => (t._count?.subtasks || 0) > 0).map((t) => t.id);
    if (parentIds.length > 0) {
      const completedCounts = await prisma.task.groupBy({
        by: ['parentTaskId'],
        where: { parentTaskId: { in: parentIds }, status: 'COMPLETED' },
        _count: { _all: true },
      });
      const completedByParent = new Map(completedCounts.map((c) => [c.parentTaskId, c._count._all]));
      for (const task of items) {
        task.subtaskCompletedCount = completedByParent.get(task.id) || 0;
      }
    }
  }

  return { items, total };
}

async function getTaskOr404(taskId) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) {
    throw new NotFoundError('Task not found', 'TASK_NOT_FOUND');
  }
  return task;
}

export async function getTask(userId, taskId) {
  const task = await getTaskOr404(taskId);
  await assertProjectAccess(userId, task.projectId);

  // A single richer fetch for the task detail view: subtasks (summary
  // only — full detail is its own getTask call), checklist in position
  // order, labels, watcher ids, both dependency directions, its parent
  // (if it is one), and any recurrence rule. Kept as one query rather than
  // the caller stitching together five separate endpoint calls.
  const [full, dependencies, dependents] = await Promise.all([
    prisma.task.findUnique({
      where: { id: taskId },
      include: {
        subtasks: { orderBy: { createdAt: 'asc' } },
        parent: { select: { id: true, title: true, status: true } },
        checklistItems: { orderBy: { position: 'asc' } },
        labels: { include: { label: true } },
        watchers: { select: { userId: true } },
        recurrenceRule: true,
      },
    }),
    prisma.taskDependency.findMany({
      where: { taskId },
      include: { dependsOnTask: { select: { id: true, title: true, status: true } } },
    }),
    prisma.taskDependency.findMany({
      where: { dependsOnTaskId: taskId },
      include: { task: { select: { id: true, title: true, status: true } } },
    }),
  ]);

  return {
    ...full,
    labels: full.labels.map((tl) => tl.label),
    watcherIds: full.watchers.map((w) => w.userId),
    dependencies: dependencies.map((d) => ({ id: d.id, task: d.dependsOnTask })),
    dependents: dependents.map((d) => ({ id: d.id, task: d.task })),
  };
}

/**
 * Updates a task. Two authorization paths:
 *  - Project Manager / workspace OWNER-ADMIN: can change any field
 *    (title, description, priority, dueDate, assigneeId, status).
 *  - The task's own assignee (with at least project access, i.e. they're a
 *    project member): can only change `status` — "update assigned tasks"
 *    per the spec's Project Member permissions, not a full edit.
 * Anyone else is forbidden.
 */
async function assertTaskWriteAccess(userId, task, fields) {
  const context = await assertProjectAccess(userId, task.projectId);

  if (context.project.status === 'ARCHIVED') {
    throw new ForbiddenError(
      'This project is archived — restore it before editing tasks',
      'PROJECT_ARCHIVED'
    );
  }

  let canManage = true;
  try {
    await assertProjectManage(userId, task.projectId);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      canManage = false;
    } else {
      throw err;
    }
  }

  if (!canManage) {
    const isAssignee = task.assigneeId === userId;
    const onlyAllowedFields = fields.every((f) => ASSIGNEE_ALLOWED_FIELDS.has(f));
    if (!isAssignee || !onlyAllowedFields) {
      throw new ForbiddenError(
        'You can only update the status of tasks assigned to you',
        'FORBIDDEN'
      );
    }
  }

  return { context, canManage };
}

export async function updateTask(userId, taskId, data) {
  const task = await getTaskOr404(taskId);
  const { context, canManage } = await assertTaskWriteAccess(userId, task, Object.keys(data));

  if (canManage && data.assigneeId !== undefined) {
    await assertTaskAssigneeIsProjectMember(task.projectId, data.assigneeId);
  }

  if (canManage && data.parentTaskId !== undefined && data.parentTaskId !== null) {
    if (data.parentTaskId === taskId) {
      throw new ForbiddenError('A task cannot be its own subtask', 'INVALID_PARENT_TASK');
    }
    // Walk up the proposed parent's ancestor chain — if it ever reaches
    // this task, setting the parent would create a cycle.
    let cursor = await prisma.task.findUnique({ where: { id: data.parentTaskId } });
    if (!cursor || cursor.projectId !== task.projectId) {
      throw new NotFoundError('Parent task not found in this project', 'PARENT_TASK_NOT_FOUND');
    }
    const seen = new Set();
    while (cursor?.parentTaskId) {
      if (cursor.parentTaskId === taskId) {
        throw new ForbiddenError('This would create a circular subtask relationship', 'CIRCULAR_SUBTASK');
      }
      if (seen.has(cursor.parentTaskId)) break; // defensive: shouldn't happen, avoid infinite loop
      seen.add(cursor.parentTaskId);
      cursor = await prisma.task.findUnique({ where: { id: cursor.parentTaskId } });
    }
  }

  // Snapshot pre-update values before mutating: `task` may be the same
  // object instance the store holds internally, so reading task.status/
  // etc. *after* prisma.task.update() would already reflect the new
  // values.
  const previous = { status: task.status, priority: task.priority, assigneeId: task.assigneeId };

  const taskUpdate = { ...data };
  if (data.status === 'COMPLETED' && previous.status !== 'COMPLETED') {
    taskUpdate.completedAt = new Date();
  } else if (data.status !== undefined && data.status !== 'COMPLETED' && previous.status === 'COMPLETED') {
    taskUpdate.completedAt = null;
  }

  const updated = await prisma.task.update({ where: { id: taskId }, data: taskUpdate });

  // Emit distinct, specific event types for the changes that matter most
  // for history/notifications (status, priority, assignment), and fall
  // back to a generic TASK_UPDATED for everything else (title,
  // description, dueDate). A single update touching several of these at
  // once still gets one entry per meaningful field, since each carries
  // its own before/after in metadata rather than being folded together.
  const entityRef = {
    entityType: 'TASK',
    entityId: taskId,
    entityLabel: updated.title,
  };
  const changeEvents = [];
  if (data.status !== undefined && data.status !== previous.status) {
    changeEvents.push({ action: 'TASK_STATUS_CHANGED', metadata: { from: previous.status, to: data.status } });
  }
  if (data.priority !== undefined && data.priority !== previous.priority) {
    changeEvents.push({ action: 'TASK_PRIORITY_CHANGED', metadata: { from: previous.priority, to: data.priority } });
  }
  if (data.assigneeId !== undefined && data.assigneeId !== previous.assigneeId) {
    changeEvents.push({
      action: 'TASK_ASSIGNED',
      metadata: { from: previous.assigneeId, to: data.assigneeId },
    });
  }
  const otherFields = Object.keys(data).filter((f) => !['status', 'priority', 'assigneeId'].includes(f));
  if (otherFields.length > 0) {
    changeEvents.push({ action: 'TASK_UPDATED', metadata: Object.fromEntries(otherFields.map((f) => [f, data[f]])) });
  }
  // Nothing actually changed (e.g. status set to its current value) —
  // still record a generic update rather than logging nothing, so the
  // action itself isn't silently lost from history.
  if (changeEvents.length === 0) {
    changeEvents.push({ action: 'TASK_UPDATED', metadata: data });
  }

  await Promise.all(
    changeEvents.map((event) =>
      logActivity({
        workspaceId: context.project.workspaceId,
        projectId: task.projectId,
        taskId,
        userId,
        ...event,
        ...entityRef,
      })
    )
  );

  // Watchers hear about status changes specifically — the change most
  // worth a heads-up — via the existing notification system, not a
  // separate delivery path.
  if (data.status !== undefined && data.status !== previous.status) {
    const { notifyWatchers } = await import('./watcher.service.js');
    await notifyWatchers(taskId, {
      excludeUserId: userId,
      title: 'Task status updated',
      message: `"${updated.title}" moved to ${data.status.replace('_', ' ').toLowerCase()}`,
    });
  }

  if (data.assigneeId && data.assigneeId !== previous.assigneeId && data.assigneeId !== userId) {
    await createNotification({
      userId: data.assigneeId,
      type: 'TASK_ASSIGNED',
      title: 'New task assigned',
      message: `You were assigned "${updated.title}"`,
    });
  }

  emitToProject(task.projectId, 'task.updated', { task: updated, actorId: userId });

  return updated;
}

export async function deleteTask(userId, taskId) {
  const task = await getTaskOr404(taskId);
  const { project } = await assertProjectManage(userId, task.projectId);

  // Log BEFORE deleting: the task row (and the FK on taskId, which is
  // SET NULL) survive the delete via this entry's entityType/entityId/
  // entityLabel snapshot, so "who deleted this and when" isn't lost.
  await logActivity({
    workspaceId: project.workspaceId,
    projectId: task.projectId,
    taskId,
    userId,
    action: 'TASK_DELETED',
    metadata: { title: task.title },
    entityType: 'TASK',
    entityId: taskId,
    entityLabel: task.title,
  });

  await prisma.task.delete({ where: { id: taskId } });

  emitToProject(task.projectId, 'task.deleted', { taskId: task.id, projectId: task.projectId, actorId: userId });
}

/**
 * Moves a task to a target status column and/or reorders it before `beforeTaskId`.
 */
export async function moveTask(userId, taskId, { status: targetStatus, beforeTaskId }) {
  const task = await getTaskOr404(taskId);
  const fields = targetStatus !== undefined ? ['status'] : [];
  const { context } = await assertTaskWriteAccess(userId, task, fields);

  const oldStatus = task.status;
  const newStatus = targetStatus || oldStatus;
  const projectId = task.projectId;
  const parentTaskId = task.parentTaskId;

  // If status is changing, handle completedAt
  const updateData = { status: newStatus };
  if (newStatus === 'COMPLETED' && oldStatus !== 'COMPLETED') {
    updateData.completedAt = new Date();
  } else if (newStatus !== 'COMPLETED' && oldStatus === 'COMPLETED') {
    updateData.completedAt = null;
  }

  // Fetch current items in destination column ordered by position
  let destTasks = await prisma.task.findMany({
    where: { projectId, status: newStatus, parentTaskId },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, position: true },
  });

  // Remove target task from destTasks list if it was already in the same column
  destTasks = destTasks.filter((t) => t.id !== taskId);

  // Determine insertion index
  let insertIndex = destTasks.length;
  if (beforeTaskId) {
    const idx = destTasks.findIndex((t) => t.id === beforeTaskId);
    if (idx !== -1) {
      insertIndex = idx;
    }
  }

  // Insert target task id at insertIndex
  destTasks.splice(insertIndex, 0, { id: taskId });
  const orderedIds = destTasks.map((t) => t.id);

  // Update target task status & completedAt
  const updatedTask = await prisma.task.update({
    where: { id: taskId },
    data: updateData,
  });

  // Reindex destination column
  await reindexColumn(projectId, newStatus, parentTaskId, orderedIds);

  // If status changed to a new column, reindex the old column as well
  if (oldStatus !== newStatus) {
    const sourceTasks = await prisma.task.findMany({
      where: { projectId, status: oldStatus, parentTaskId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      select: { id: true },
    });
    await reindexColumn(projectId, oldStatus, parentTaskId, sourceTasks.map((t) => t.id));

    // Log status change activity
    await logActivity({
      workspaceId: context.project.workspaceId,
      projectId,
      taskId,
      userId,
      action: 'TASK_STATUS_CHANGED',
      entityType: 'TASK',
      entityId: taskId,
      entityLabel: updatedTask.title,
      metadata: { from: oldStatus, to: newStatus },
    });

    // Notify watchers
    const { notifyWatchers } = await import('./watcher.service.js');
    await notifyWatchers(taskId, {
      excludeUserId: userId,
      title: 'Task status updated',
      message: `"${updatedTask.title}" moved to ${newStatus.replace('_', ' ').toLowerCase()}`,
    });
  } else {
    // Reordered within same column
    await logActivity({
      workspaceId: context.project.workspaceId,
      projectId,
      taskId,
      userId,
      action: 'TASK_REORDERED',
      entityType: 'TASK',
      entityId: taskId,
      entityLabel: updatedTask.title,
      metadata: { status: newStatus, position: insertIndex },
    });
  }

  emitToProject(projectId, 'task.updated', { task: updatedTask, actorId: userId });
  return updatedTask;
}

/**
 * Performs bulk updates across multiple tasks (status, priority, assigneeId, dueDate, addLabelId, removeLabelId).
 */
export async function bulkUpdateTasks(userId, payload) {
  const { taskIds, status, priority, assigneeId, dueDate, addLabelId, removeLabelId } = payload;
  if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
    throw new ValidationError('taskIds must be a non-empty array');
  }

  // Fetch all tasks
  const tasks = await prisma.task.findMany({
    where: { id: { in: taskIds } },
  });

  if (tasks.length !== taskIds.length) {
    throw new NotFoundError('One or more tasks were not found', 'TASKS_NOT_FOUND');
  }

  // Activity logging needs each task's workspace id. Resolve the distinct
  // projects once instead of issuing one project query for every task in a
  // bulk request (up to 50 tasks).
  const projects = await prisma.project.findMany({
    where: { id: { in: [...new Set(tasks.map((task) => task.projectId))] } },
    select: { id: true, workspaceId: true },
  });
  const workspaceIdByProjectId = new Map(projects.map((project) => [project.id, project.workspaceId]));

  // Validate access and permissions for each task
  const fields = [];
  if (status !== undefined) fields.push('status');
  if (priority !== undefined) fields.push('priority');
  if (assigneeId !== undefined) fields.push('assigneeId');
  if (dueDate !== undefined) fields.push('dueDate');

  for (const task of tasks) {
    await assertTaskWriteAccess(userId, task, fields);
    if (assigneeId !== undefined && assigneeId !== null) {
      await assertTaskAssigneeIsProjectMember(task.projectId, assigneeId);
    }
  }

  // Process updates - batch task updates where possible
  const updatedTasks = [];

  // Prepare base update data (same for all tasks)
  const baseUpdateData = {};
  if (status !== undefined) {
    baseUpdateData.status = status;
  }
  if (priority !== undefined) {
    baseUpdateData.priority = priority;
  }
  if (assigneeId !== undefined) {
    baseUpdateData.assigneeId = assigneeId;
  }
  if (dueDate !== undefined) {
    baseUpdateData.dueDate = dueDate ? new Date(dueDate) : null;
  }

  // Process tasks in batches for better performance
  // We'll process in chunks of 20 to avoid too many concurrent operations
  const batchSize = 20;
  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize);

    // Process each task in the batch
    const batchPromises = batch.map(async (task) => {
      // Start with base update data
      const data = { ...baseUpdateData };

      // Handle completedAt logic based on task's current status
      if (status !== undefined) {
        if (status === 'COMPLETED' && task.status !== 'COMPLETED') {
          data.completedAt = new Date();
        } else if (status !== 'COMPLETED' && task.status === 'COMPLETED') {
          data.completedAt = null;
        }
      }

      let updated = task;
      // Only update if there are actual changes
      if (Object.keys(data).length > 0) {
        updated = await prisma.task.update({
          where: { id: task.id },
          data,
        });
      }

      // Handle label operations
      if (addLabelId) {
        await addLabelToTask(userId, task.id, addLabelId).catch(() => {});
      }
      if (removeLabelId) {
        await removeLabelFromTask(userId, task.id, removeLabelId).catch(() => {});
      }

      // Log activity
      await logActivity({
        workspaceId: workspaceIdByProjectId.get(task.projectId),
        projectId: task.projectId,
        taskId: task.id,
        userId,
        action: 'TASK_BULK_UPDATED',
        entityType: 'TASK',
        entityId: task.id,
        entityLabel: updated.title,
        metadata: { updates: payload },
      });

      emitToProject(task.projectId, 'task.updated', { task: updated, actorId: userId });
      return updated;
    });

    // Wait for batch to complete
    const batchResults = await Promise.all(batchPromises);
    updatedTasks.push(...batchResults);
  }

  return { updatedCount: updatedTasks.length, tasks: updatedTasks };
}
