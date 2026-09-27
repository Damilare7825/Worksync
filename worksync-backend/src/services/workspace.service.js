import crypto from 'crypto';
import { prisma } from '../config/database.js';
import { BadRequestError, ForbiddenError, NotFoundError, ConflictError } from '../utils/errors.js';
import { assertWorkspaceMembership, assertWorkspaceRole, getWorkspaceMembership, invalidateWorkspaceAuth } from './authorization.service.js';
import { logActivity } from './activity.service.js';
import { env } from '../config/env.js';
import { hashResetToken } from '../utils/token.js';

export async function createWorkspace(userId, { name }) {
  // Everything below happens atomically: a workspace should never exist
  // for a moment without its OWNER membership row.
  const workspace = await prisma.$transaction(async (tx) => {
    const ws = await tx.workspace.create({ data: { name, createdBy: userId } });
    await tx.workspaceMember.create({
      data: { workspaceId: ws.id, userId, role: 'OWNER' },
    });
    return ws;
  });

  await logActivity({
    workspaceId: workspace.id,
    userId,
    action: 'WORKSPACE_CREATED',
    metadata: { name: workspace.name },
  });

  return workspace;
}

export async function listUserWorkspaces(userId, { skip, take } = {}) {
  const where = { userId };
  const [memberships, total] = await Promise.all([
    prisma.workspaceMember.findMany({
      where,
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            createdBy: true,
            inviteLinkEnabled: true,
            inviteLinkRole: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      ...(skip !== undefined ? { skip } : {}),
      ...(take !== undefined ? { take } : {}),
    }),
    prisma.workspaceMember.count({ where }),
  ]);
  return { items: memberships.map((m) => ({ ...m.workspace, membership: { role: m.role } })), total };
}

export async function getWorkspace(userId, workspaceId) {
  const membership = await assertWorkspaceMembership(userId, workspaceId);
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  return { ...workspace, membership: { role: membership.role } };
}

// "Update workspace settings" is an OWNER-only privilege per the spec —
// ADMIN can manage members/projects/teams but not workspace settings.
export async function updateWorkspace(userId, workspaceId, data) {
  await assertWorkspaceRole(userId, workspaceId, ['OWNER']);
  const workspace = await prisma.workspace.update({ where: { id: workspaceId }, data });
  await logActivity({ workspaceId, userId, action: 'WORKSPACE_UPDATED', metadata: data });
  return workspace;
}

export async function deleteWorkspace(userId, workspaceId) {
  await assertWorkspaceRole(userId, workspaceId, ['OWNER']);
  await prisma.workspace.delete({ where: { id: workspaceId } });
}

export async function listMembers(userId, workspaceId, { skip, take }) {
  await assertWorkspaceMembership(userId, workspaceId);
  const [items, total] = await Promise.all([
    prisma.workspaceMember.findMany({
      where: { workspaceId },
      skip,
      take,
      orderBy: { joinedAt: 'asc' },
      include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
    }),
    prisma.workspaceMember.count({ where: { workspaceId } }),
  ]);
  return { items, total };
}

/**
 * Changes a member's role, including ownership transfer.
 *
 * - Only an OWNER may change roles at all ("Change member roles" is
 *   OWNER-only per the spec; ADMIN cannot promote itself or anyone else).
 * - Setting role to OWNER is an ownership transfer: the current OWNER is
 *   atomically demoted to ADMIN in the same transaction, so the workspace
 *   is never left with zero or two owners.
 * - An OWNER cannot demote themselves through this path (would leave the
 *   workspace ownerless) — use a dedicated transfer instead.
 */
export async function updateMemberRole(actorId, workspaceId, targetMembershipId, newRole) {
  const actorMembership = await assertWorkspaceRole(actorId, workspaceId, ['OWNER']);

  const target = await prisma.workspaceMember.findUnique({ where: { id: targetMembershipId } });
  if (!target || target.workspaceId !== workspaceId) {
    throw new NotFoundError('Workspace member not found', 'MEMBER_NOT_FOUND');
  }

  if (target.id === actorMembership.id && newRole !== 'OWNER') {
    throw new BadRequestError(
      'Use ownership transfer to change your own role; an owner cannot demote themselves directly',
      'CANNOT_SELF_DEMOTE'
    );
  }

  if (newRole === 'OWNER') {
    const [, updatedTarget] = await prisma.$transaction([
      prisma.workspaceMember.update({ where: { id: actorMembership.id }, data: { role: 'ADMIN' } }),
      prisma.workspaceMember.update({ where: { id: target.id }, data: { role: 'OWNER' } }),
    ]);
    await logActivity({
      workspaceId,
      userId: actorId,
      action: 'WORKSPACE_OWNERSHIP_TRANSFERRED',
      metadata: { newOwnerUserId: target.userId },
      isAudit: true,
    });
    return updatedTarget;
  }

  const updated = await prisma.workspaceMember.update({
    where: { id: target.id },
    data: { role: newRole },
  });
  await logActivity({
    workspaceId,
    userId: actorId,
    action: 'WORKSPACE_MEMBER_ROLE_CHANGED',
    metadata: { targetUserId: target.userId, newRole },
    isAudit: true,
  });
  invalidateWorkspaceAuth(workspaceId);
  return updated;
}

/**
 * Removes a member. OWNER or ADMIN may remove members, but:
 * - the OWNER can never be removed this way (must transfer ownership first)
 * - ADMIN cannot remove the OWNER (would be a privilege escalation path)
 */
export async function removeMember(actorId, workspaceId, targetMembershipId) {
  const actorMembership = await assertWorkspaceRole(actorId, workspaceId, ['OWNER', 'ADMIN']);

  const target = await prisma.workspaceMember.findUnique({ where: { id: targetMembershipId } });
  if (!target || target.workspaceId !== workspaceId) {
    throw new NotFoundError('Workspace member not found', 'MEMBER_NOT_FOUND');
  }

  if (target.role === 'OWNER') {
    throw new ForbiddenError('The workspace owner cannot be removed', 'CANNOT_REMOVE_OWNER');
  }

  if (target.id === actorMembership.id) {
    throw new BadRequestError('Use the leave-workspace flow to remove yourself', 'CANNOT_SELF_REMOVE');
  }

  await prisma.workspaceMember.delete({ where: { id: target.id } });
  await logActivity({
    workspaceId,
    userId: actorId,
    action: 'WORKSPACE_MEMBER_REMOVED',
    metadata: { targetUserId: target.userId },
    isAudit: true,
  });
  invalidateWorkspaceAuth(workspaceId, target.userId);
}

// ---------------------------------------------------------------------------
// Shareable workspace invite link — a second, distinct way to invite people
// alongside the per-email Invitation flow. Anyone holding this link (and
// logged in) can join at the role the OWNER/ADMIN configured, without a
// specific email being pre-approved. Because it's meant to be looked up and
// re-copied at any time (not a one-shot secret bound to a recipient's
// identity), the token is stored as-is rather than hashed — a deliberately
// different tradeoff than Invitation.tokenHash, and revocation is "disable
// or regenerate", not "gets consumed".
// ---------------------------------------------------------------------------

function buildInviteLinkUrl(rawToken) {
  return `${env.clientUrl}/join/${rawToken}`;
}

/**
 * Returns the current invite-link state for the members/overview panel.
 *
 * IMPORTANT: `workspace.inviteLinkToken` in the database is a SHA-256
 * hash (see enableInviteLink/regenerateInviteLink below) — the raw,
 * shareable token is deliberately never persisted anywhere, the same
 * security tradeoff as Invitation.tokenHash. That means this function
 * can NEVER reconstruct a working invite URL from what's in the DB; the
 * only two places that ever see the raw token are the enable/regenerate
 * responses themselves, right as it's generated.
 *
 * So: report whether a link is enabled (for the UI toggle state), but
 * only ever include `inviteUrl` when we have the real, unhashed token —
 * which this function never does. The caller must prompt for
 * enable/regenerate to get a link that will actually resolve.
 */
export async function getInviteLink(userId, workspaceId) {
  await assertWorkspaceRole(userId, workspaceId, ['OWNER', 'ADMIN']);
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  return {
    enabled: workspace.inviteLinkEnabled,
    role: workspace.inviteLinkRole,
    // Never derivable from storage — see note above. Always null here;
    // only enable/regenerate ever return a real inviteUrl.
    inviteUrl: null,
    hasActiveLink: Boolean(workspace.inviteLinkEnabled && workspace.inviteLinkToken),
  };
}

/**
 * Turns the link on, generating a fresh token each time. Safe to call
 * repeatedly — each call generates a new token for security (prevents
 * use of old tokens after intentional disabling).
 *
 * Token is hashed before storage (same as Invitation.tokenHash) to protect
 * against database compromise or log leaks revealing the secret.
 */
export async function enableInviteLink(userId, workspaceId, { role = 'MEMBER' } = {}) {
  await assertWorkspaceRole(userId, workspaceId, ['OWNER', 'ADMIN']);

  // Always generate a fresh token for security
  const token = crypto.randomBytes(24).toString('hex');
  const tokenHash = hashResetToken(token);

  const updated = await prisma.workspace.update({
    where: { id: workspaceId },
    data: { inviteLinkEnabled: true, inviteLinkToken: tokenHash, inviteLinkRole: role },
  });
  await logActivity({ workspaceId, userId, action: 'WORKSPACE_INVITE_LINK_ENABLED', metadata: { role }, isAudit: true });

  return { enabled: true, role: updated.inviteLinkRole, inviteUrl: buildInviteLinkUrl(token) };
}

export async function disableInviteLink(userId, workspaceId) {
  await assertWorkspaceRole(userId, workspaceId, ['OWNER', 'ADMIN']);
  await prisma.workspace.update({ where: { id: workspaceId }, data: { inviteLinkEnabled: false } });
  await logActivity({ workspaceId, userId, action: 'WORKSPACE_INVITE_LINK_DISABLED', metadata: {}, isAudit: true });
}

/**
 * Invalidates the old link entirely (new random token) — for when a link
 * has been shared too widely and needs to stop working immediately,
 * distinct from just pausing it. Token is hashed before storage.
 */
export async function regenerateInviteLink(userId, workspaceId) {
  await assertWorkspaceRole(userId, workspaceId, ['OWNER', 'ADMIN']);
  const token = crypto.randomBytes(24).toString('hex');
  const tokenHash = hashResetToken(token);

  const updated = await prisma.workspace.update({
    where: { id: workspaceId },
    data: { inviteLinkToken: tokenHash, inviteLinkEnabled: true },
  });
  await logActivity({ workspaceId, userId, action: 'WORKSPACE_INVITE_LINK_REGENERATED', metadata: {}, isAudit: true });
  return { enabled: true, role: updated.inviteLinkRole, inviteUrl: buildInviteLinkUrl(token) };
}

/**
 * Looks up a workspace by its invite-link token without requiring
 * authentication — mirrors how an Invitation can be previewed before
 * login, so the join page can show "You're about to join X" up front.
 * Hashes the raw token before lookup (same pattern as Invitation.findInvitationByToken).
 */
export async function getWorkspaceByInviteLinkToken(rawToken) {
  const tokenHash = hashResetToken(rawToken);
  const workspace = await prisma.workspace.findUnique({ where: { inviteLinkToken: tokenHash } });
  if (!workspace || !workspace.inviteLinkEnabled) {
    throw new NotFoundError('This invite link is invalid or no longer active', 'INVITE_LINK_NOT_FOUND');
  }
  return { id: workspace.id, name: workspace.name, role: workspace.inviteLinkRole };
}

/**
 * Joins the authenticated user to the workspace via a shareable link.
 * Unlike Invitation acceptance, there's no specific email to match — the
 * link itself is the authorization. Duplicate-membership is still
 * rejected the same way. Hashes the raw token before lookup.
 */
export async function joinViaInviteLink(userId, rawToken) {
  const tokenHash = hashResetToken(rawToken);
  const workspace = await prisma.workspace.findUnique({ where: { inviteLinkToken: tokenHash } });
  if (!workspace || !workspace.inviteLinkEnabled) {
    throw new NotFoundError('This invite link is invalid or no longer active', 'INVITE_LINK_NOT_FOUND');
  }

  const existing = await getWorkspaceMembership(userId, workspace.id);
  if (existing) {
    throw new ConflictError('You are already a member of this workspace', 'ALREADY_MEMBER');
  }

  const membership = await prisma.workspaceMember.create({
    data: { workspaceId: workspace.id, userId, role: workspace.inviteLinkRole },
  });
  await logActivity({
    workspaceId: workspace.id,
    userId,
    action: 'USER_JOINED_WORKSPACE',
    metadata: { via: 'invite_link', role: workspace.inviteLinkRole },
  });
  invalidateWorkspaceAuth(workspace.id, userId);

  return { membership, workspace: { id: workspace.id, name: workspace.name } };
}
