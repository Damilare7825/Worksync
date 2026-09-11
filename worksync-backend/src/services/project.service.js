import { prisma } from '../config/database.js';
import { ConflictError, NotFoundError } from '../utils/errors.js';
import {
  assertProjectAccess,
  assertProjectManage,
  assertWorkspaceMembership,
  assertWorkspaceRole,
  getProjectContext,
  getWorkspaceMembership,
  isWorkspaceAdminOrOwner,
} from './authorization.service.js';
import { logActivity } from './activity.service.js';

// "Create projects" is an OWNER/ADMIN privilege per the spec's workspace
// permission table. The creator is NOT automatically a ProjectMember —
// workspace OWNER/ADMIN already have management access to every project in
// the workspace via assertProjectManage, so an extra membership row would
// just be redundant bookkeeping. They can add themselves as MANAGER
// explicitly if they want to show up in the project's member list.
export async function createProject(userId, workspaceId, data) {
  await assertWorkspaceRole(userId, workspaceId, ['OWNER', 'ADMIN']);
  const project = await prisma.project.create({
    data: { ...data, workspaceId, createdBy: userId },
  });
  await logActivity({
    workspaceId,
    projectId: project.id,
    userId,
    action: 'PROJECT_CREATED',
    metadata: { name: project.name },
  });
  return project;
}

export async function listProjects(userId, workspaceId, { skip, take }, { status } = {}) {
  const membership = await assertWorkspaceMembership(userId, workspaceId);

  // Workspace OWNER/ADMIN see every project; a plain MEMBER only sees
  // projects they're an explicit ProjectMember of.
  const where = isWorkspaceAdminOrOwner(membership.role)
    ? { workspaceId }
    : { workspaceId, members: { some: { userId } } };

  // Default view is "not archived" — archived projects stay reachable
  // (getProject, project detail, its own task/activity history all still
  // work) but shouldn't clutter the everyday project list. Pass
  // status: 'ARCHIVED' explicitly to see just the archive, or omit
  // filtering entirely isn't supported since "all statuses at once" isn't
  // a real use case here — callers that want archived projects ask for
  // them specifically.
  if (status) {
    where.status = status;
  } else {
    where.status = { not: 'ARCHIVED' };
  }

  const [items, total] = await Promise.all([
    prisma.project.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.project.count({ where }),
  ]);
  return { items, total };
}

export async function getProject(userId, projectId) {
  const { project, projectMembership } = await assertProjectAccess(userId, projectId);
  return { ...project, membership: projectMembership ? { role: projectMembership.role } : null };
}

export async function updateProject(userId, projectId, data) {
  const { project } = await assertProjectManage(userId, projectId);

  // Archiving/restoring is a distinct lifecycle action with its own
  // activity event and side effects (see archiveProject/restoreProject
  // below) — route status transitions there instead of logging a generic
  // PROJECT_UPDATED for them, even when they arrive bundled into a larger
  // PATCH body alongside other field changes.
  if (data.status !== undefined && data.status !== project.status) {
    if (data.status === 'ARCHIVED') {
      const { status: _status, ...rest } = data;
      const archived = await archiveProject(userId, projectId);
      if (Object.keys(rest).length === 0) return archived;
      return updateProject(userId, projectId, rest);
    }
    if (project.status === 'ARCHIVED' && (data.status === 'ACTIVE' || data.status === 'COMPLETED')) {
      const { status, ...rest } = data;
      const restored = await restoreProject(userId, projectId, status);
      if (Object.keys(rest).length === 0) return restored;
      return updateProject(userId, projectId, rest);
    }
  }

  const updated = await prisma.project.update({ where: { id: project.id }, data });
  await logActivity({
    workspaceId: project.workspaceId,
    projectId: project.id,
    userId,
    action: 'PROJECT_UPDATED',
    metadata: data,
    entityType: 'PROJECT',
    entityId: project.id,
    entityLabel: updated.name,
  });
  return updated;
}

/**
 * Archives a project: it moves out of the active working set but is never
 * deleted (per spec — archiving, not deletion, is the default lifecycle
 * exit). Archived projects remain visible/readable (history, members,
 * search) but become read-only for tasks — see the ARCHIVED guards in
 * task.service.js's createTask/updateTask.
 */
export async function archiveProject(userId, projectId) {
  const { project } = await assertProjectManage(userId, projectId);
  if (project.status === 'ARCHIVED') {
    return project;
  }
  const updated = await prisma.project.update({ where: { id: projectId }, data: { status: 'ARCHIVED' } });
  await logActivity({
    workspaceId: project.workspaceId,
    projectId,
    userId,
    action: 'PROJECT_ARCHIVED',
    metadata: { previousStatus: project.status },
    entityType: 'PROJECT',
    entityId: projectId,
    entityLabel: updated.name,
    isAudit: true,
  });
  return updated;
}

/**
 * Restores an archived project back to the active working set (or
 * directly to COMPLETED, if that's where it should land — e.g. restoring
 * a project that was archived after being finished).
 */
export async function restoreProject(userId, projectId, targetStatus = 'ACTIVE') {
  const { project } = await assertProjectManage(userId, projectId);
  if (project.status !== 'ARCHIVED') {
    return project;
  }
  const updated = await prisma.project.update({ where: { id: projectId }, data: { status: targetStatus } });
  await logActivity({
    workspaceId: project.workspaceId,
    projectId,
    userId,
    action: 'PROJECT_RESTORED',
    metadata: { newStatus: targetStatus },
    entityType: 'PROJECT',
    entityId: projectId,
    entityLabel: updated.name,
    isAudit: true,
  });
  return updated;
}

// "Delete projects" is explicitly OWNER-only in the spec (ADMIN can
// "Manage projects" but deletion isn't listed under ADMIN).
export async function deleteProject(userId, projectId) {
  const { project } = await getProjectContext(userId, projectId);
  await assertWorkspaceRole(userId, project.workspaceId, ['OWNER']);
  await prisma.project.delete({ where: { id: project.id } });
}

export async function listProjectMembers(userId, projectId) {
  await assertProjectAccess(userId, projectId);
  return prisma.projectMember.findMany({
    where: { projectId },
    include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
    orderBy: { joinedAt: 'asc' },
  });
}

export async function addProjectMember(userId, projectId, { userId: targetUserId, role }) {
  const { project } = await assertProjectManage(userId, projectId);

  // The person being added must belong to the same workspace as the
  // project — a project can't pull in a member from a different workspace.
  const targetWorkspaceMembership = await getWorkspaceMembership(targetUserId, project.workspaceId);
  if (!targetWorkspaceMembership) {
    throw new NotFoundError('User is not a member of this workspace', 'NOT_WORKSPACE_MEMBER');
  }

  const existing = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: targetUserId } },
  });
  if (existing) {
    throw new ConflictError('User is already a member of this project', 'ALREADY_PROJECT_MEMBER');
  }

  const member = await prisma.projectMember.create({ data: { projectId, userId: targetUserId, role } });
  await logActivity({
    workspaceId: project.workspaceId,
    projectId,
    userId,
    action: 'PROJECT_MEMBER_ADDED',
    metadata: { targetUserId, role },
  });
  return member;
}

export async function updateProjectMember(userId, projectId, memberId, role) {
  const { project } = await assertProjectManage(userId, projectId);

  const target = await prisma.projectMember.findUnique({ where: { id: memberId } });
  if (!target || target.projectId !== projectId) {
    throw new NotFoundError('Project member not found', 'PROJECT_MEMBER_NOT_FOUND');
  }

  const updated = await prisma.projectMember.update({ where: { id: target.id }, data: { role } });
  await logActivity({
    workspaceId: project.workspaceId,
    projectId,
    userId,
    action: 'PROJECT_MEMBER_ROLE_CHANGED',
    metadata: { targetUserId: target.userId, newRole: role },
    isAudit: true,
  });
  return updated;
}

export async function removeProjectMember(userId, projectId, memberId) {
  const { project } = await assertProjectManage(userId, projectId);

  const target = await prisma.projectMember.findUnique({ where: { id: memberId } });
  if (!target || target.projectId !== projectId) {
    throw new NotFoundError('Project member not found', 'PROJECT_MEMBER_NOT_FOUND');
  }

  await prisma.projectMember.delete({ where: { id: target.id } });
  await logActivity({
    workspaceId: project.workspaceId,
    projectId,
    userId,
    action: 'PROJECT_MEMBER_REMOVED',
    metadata: { targetUserId: target.userId },
    isAudit: true,
  });
}

/**
 * Lightweight project-level statistics (task counts by status/priority,
 * overdue count, member count) — the "project analytics foundations"
 * called for in Phase 13. Deliberately simple: richer analytics/reporting
 * is a later phase's concern, this just gives the project overview page
 * something real to show instead of nothing.
 */
export async function getProjectStats(userId, projectId) {
  const { project } = await assertProjectAccess(userId, projectId);
  const now = new Date();

  const [total, byStatusRaw, overdue, memberCount] = await Promise.all([
    prisma.task.count({ where: { projectId } }),
    prisma.task.groupBy({ by: ['status'], where: { projectId }, _count: { _all: true } }),
    prisma.task.count({ where: { projectId, status: { not: 'COMPLETED' }, dueDate: { lt: now } } }),
    prisma.projectMember.count({ where: { projectId } }),
  ]);

  const tasksByStatus = { BACKLOG: 0, TODO: 0, IN_PROGRESS: 0, IN_REVIEW: 0, COMPLETED: 0 };
  for (const row of byStatusRaw) {
    tasksByStatus[row.status] = row._count._all;
  }

  return {
    projectId,
    status: project.status,
    totalTasks: total,
    tasksByStatus,
    overdueTasks: overdue,
    memberCount,
  };
}
