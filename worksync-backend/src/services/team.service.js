import { prisma } from '../config/database.js';
import { ConflictError, NotFoundError } from '../utils/errors.js';
import {
  assertWorkspaceMembership,
  assertWorkspaceRole,
  getTeamContext,
  getWorkspaceMembership,
} from './authorization.service.js';
import { logActivity } from './activity.service.js';

// "Manage teams" is an OWNER/ADMIN privilege in the spec's permission
// table — plain MEMBERs can view teams but not create/edit/delete them.
export async function createTeam(userId, workspaceId, { name, description }) {
  await assertWorkspaceRole(userId, workspaceId, ['OWNER', 'ADMIN']);
  const team = await prisma.team.create({
    data: { workspaceId, name, description, createdBy: userId },
  });
  await logActivity({ workspaceId, userId, action: 'TEAM_CREATED', metadata: { name } });
  return team;
}

export async function listTeams(userId, workspaceId, { skip, take } = {}) {
  await assertWorkspaceMembership(userId, workspaceId);
  return prisma.team.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { members: true } } },
    ...(skip !== undefined ? { skip } : {}),
    ...(take !== undefined ? { take } : {}),
  });
}

export async function getTeam(userId, teamId) {
  const { team } = await getTeamContext(userId, teamId);
  const members = await prisma.teamMember.findMany({
    where: { teamId },
    include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
  });
  return { ...team, members };
}

export async function updateTeam(userId, teamId, data) {
  const { team } = await getTeamContext(userId, teamId);
  await assertWorkspaceRole(userId, team.workspaceId, ['OWNER', 'ADMIN']);
  const updated = await prisma.team.update({ where: { id: teamId }, data });
  await logActivity({ workspaceId: team.workspaceId, userId, action: 'TEAM_UPDATED', metadata: data });
  return updated;
}

export async function deleteTeam(userId, teamId) {
  const { team } = await getTeamContext(userId, teamId);
  await assertWorkspaceRole(userId, team.workspaceId, ['OWNER', 'ADMIN']);
  await prisma.team.delete({ where: { id: teamId } });
  await logActivity({ workspaceId: team.workspaceId, userId, action: 'TEAM_DELETED', metadata: { teamId } });
}

export async function addTeamMember(userId, teamId, targetUserId) {
  const { team } = await getTeamContext(userId, teamId);
  await assertWorkspaceRole(userId, team.workspaceId, ['OWNER', 'ADMIN']);

  // The person being added must actually belong to the workspace — a team
  // is a grouping inside a workspace, not a way to pull in outsiders.
  const targetMembership = await getWorkspaceMembership(targetUserId, team.workspaceId);
  if (!targetMembership) {
    throw new NotFoundError('User is not a member of this workspace', 'NOT_WORKSPACE_MEMBER');
  }

  const existing = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId: targetUserId } },
  });
  if (existing) {
    throw new ConflictError('User is already a member of this team', 'ALREADY_TEAM_MEMBER');
  }

  const member = await prisma.teamMember.create({ data: { teamId, userId: targetUserId } });
  await logActivity({
    workspaceId: team.workspaceId,
    userId,
    action: 'TEAM_MEMBER_ADDED',
    metadata: { teamId, targetUserId },
  });
  return member;
}

export async function removeTeamMember(userId, teamId, targetUserId) {
  const { team } = await getTeamContext(userId, teamId);
  await assertWorkspaceRole(userId, team.workspaceId, ['OWNER', 'ADMIN']);

  const existing = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId: targetUserId } },
  });
  if (!existing) {
    throw new NotFoundError('Team member not found', 'TEAM_MEMBER_NOT_FOUND');
  }

  await prisma.teamMember.delete({ where: { id: existing.id } });
  await logActivity({
    workspaceId: team.workspaceId,
    userId,
    action: 'TEAM_MEMBER_REMOVED',
    metadata: { teamId, targetUserId },
  });
}
