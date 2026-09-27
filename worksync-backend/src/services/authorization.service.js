import { prisma } from '../config/database.js';
import { ForbiddenError, NotFoundError } from '../utils/errors.js';
import { appCache } from '../utils/cache.js';

const AUTH_CACHE_TTL_SECONDS = 30;

/**
 * Invalidation helpers for workspace and project membership mutations.
 */
export function invalidateWorkspaceAuth(workspaceId, userId = null) {
  if (userId) {
    appCache.del(`auth:ws:${workspaceId}:${userId}`);
  } else {
    appCache.delByPrefix(`auth:ws:${workspaceId}:`);
  }
  // Workspace membership affects project context lookups as well
  appCache.delByPrefix('auth:proj:');
}

export function invalidateProjectAuth(projectId, userId = null) {
  if (userId) {
    appCache.del(`auth:proj:${projectId}:${userId}`);
  } else {
    appCache.delByPrefix(`auth:proj:${projectId}:`);
  }
}

/**
 * All workspace/project access control lives here, in one place, so every
 * route enforces it the same way. Nothing outside this file should query
 * WorkspaceMember or ProjectMember directly for authorization purposes.
 *
 * Authentication (`req.user`) answers "who is this?". Everything below
 * answers "what can they do here?" — re-derived with a short in-memory
 * TTL cache (30s) invalidated on membership/role changes.
 */

// ---------------------------------------------------------------------------
// Workspace
// ---------------------------------------------------------------------------

export async function getWorkspaceMembership(userId, workspaceId) {
  const cacheKey = `auth:ws:${workspaceId}:${userId}`;
  return appCache.wrap(cacheKey, AUTH_CACHE_TTL_SECONDS, () =>
    prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    })
  );
}

/**
 * Confirms the user belongs to the workspace at all. This is the check
 * every workspace-scoped resource (projects, teams, activity, members)
 * must pass before anything else — it's what prevents a user from Workspace
 * A reading Workspace B's data just by changing an ID in the URL.
 */
export async function assertWorkspaceMembership(userId, workspaceId) {
  const membership = await getWorkspaceMembership(userId, workspaceId);
  if (!membership) {
    // 404, not 403: don't confirm the workspace exists to a non-member.
    throw new NotFoundError('Workspace not found', 'WORKSPACE_NOT_FOUND');
  }
  return membership;
}

/**
 * Confirms the user's workspace role is one of `allowedRoles`.
 */
export async function assertWorkspaceRole(userId, workspaceId, allowedRoles) {
  const membership = await assertWorkspaceMembership(userId, workspaceId);
  if (!allowedRoles.includes(membership.role)) {
    throw new ForbiddenError(
      'You do not have permission to perform this action in this workspace',
      'FORBIDDEN'
    );
  }
  return membership;
}

export const isWorkspaceAdminOrOwner = (role) => role === 'OWNER' || role === 'ADMIN';

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

/**
 * Loads a project plus the caller's workspace membership and (if any)
 * project membership, in one pass. Every project/task/comment operation
 * should go through this rather than fetching the project directly, so
 * workspace-scoping is never accidentally skipped.
 */
export async function getProjectContext(userId, projectId) {
  const cacheKey = `auth:proj:${projectId}:${userId}`;
  return appCache.wrap(cacheKey, AUTH_CACHE_TTL_SECONDS, async () => {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw new NotFoundError('Project not found', 'PROJECT_NOT_FOUND');
    }

    const workspaceMembership = await getWorkspaceMembership(userId, project.workspaceId);
    if (!workspaceMembership) {
      // Same rationale as assertWorkspaceMembership: don't leak existence.
      throw new NotFoundError('Project not found', 'PROJECT_NOT_FOUND');
    }

    const projectMembership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });

    return { project, workspaceMembership, projectMembership };
  });
}

/**
 * Read access to a project: any workspace ADMIN/OWNER can view any project
 * in their workspace; a plain workspace MEMBER needs an explicit
 * ProjectMember row.
 */
export async function assertProjectAccess(userId, projectId) {
  const context = await getProjectContext(userId, projectId);
  const { workspaceMembership, projectMembership } = context;

  const hasAccess = isWorkspaceAdminOrOwner(workspaceMembership.role) || Boolean(projectMembership);
  if (!hasAccess) {
    throw new NotFoundError('Project not found', 'PROJECT_NOT_FOUND');
  }

  return context;
}

/**
 * Management access to a project (edit settings, manage members, create/
 * assign/edit tasks): workspace OWNER/ADMIN, or a project MANAGER. A plain
 * project MEMBER does not qualify — see the spec's Project Member
 * permissions (can't manage members, settings, or the manager).
 */
export async function assertProjectManage(userId, projectId) {
  const context = await getProjectContext(userId, projectId);
  const { workspaceMembership, projectMembership } = context;

  const canManage =
    isWorkspaceAdminOrOwner(workspaceMembership.role) ||
    projectMembership?.role === 'MANAGER';

  if (!canManage) {
    throw new ForbiddenError(
      'You do not have permission to manage this project',
      'FORBIDDEN'
    );
  }

  return context;
}

// ---------------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------------

export async function getTeamContext(userId, teamId) {
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) {
    throw new NotFoundError('Team not found', 'TEAM_NOT_FOUND');
  }
  const workspaceMembership = await assertWorkspaceMembership(userId, team.workspaceId);
  return { team, workspaceMembership };
}
