import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { BadRequestError, ConflictError, NotFoundError } from '../utils/errors.js';
import { generateResetToken, hashResetToken } from '../utils/token.js';
import { assertWorkspaceRole, getWorkspaceMembership } from './authorization.service.js';
import { sendWorkspaceInvitationEmail } from './email/index.js';
import { createNotification } from './notification.service.js';
import { logActivity } from './activity.service.js';
import { getOrCreateNotificationPreferences } from './user.service.js';

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function buildInviteUrl(rawToken) {
  return `${env.clientUrl}/invitations/${rawToken}`;
}

// Reused directly: same "raw token to the user, hash to the DB" pattern as
// password reset. generateResetToken()/hashResetToken() are generic despite
// the name — they just generate/hash a random token.

export async function createInvitation(actorId, workspaceId, { email, role }) {
  // Both OWNER and ADMIN can invite, per the spec.
  await assertWorkspaceRole(actorId, workspaceId, ['OWNER', 'ADMIN']);

  // Cache notification preferences by userId to avoid repeated DB fetches
  const preferencesCache = new Map();

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    const existingMembership = await getWorkspaceMembership(existingUser.id, workspaceId);
    if (existingMembership) {
      throw new ConflictError('This user is already a member of the workspace', 'ALREADY_MEMBER');
    }
  }

  const existingInvite = await prisma.invitation.findFirst({
    where: { workspaceId, email, status: 'INVITED' },
  });
  if (existingInvite) {
    throw new ConflictError('An active invitation already exists for this email', 'INVITATION_EXISTS');
  }

  const { token, tokenHash } = generateResetToken();
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });

  const invitation = await prisma.invitation.create({
    data: {
      workspaceId,
      email,
      role,
      invitedBy: actorId,
      tokenHash,
      expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
    },
  });

  await sendWorkspaceInvitationEmail(email, workspace.name, buildInviteUrl(token), role);
  await logActivity({
    workspaceId,
    userId: actorId,
    action: 'USER_INVITED',
    metadata: { email, role },
    isAudit: true,
  });

  // If the invited email already belongs to a WorkSync account, surface an
  // in-app notification immediately so they don't have to rely on email.
  // If no account exists yet, there is no user row to attach a
  // notification to, so we simply skip this — the invitation itself is
  // still resolvable later once/if they sign up and open the link.
  if (existingUser) {
    // Get cached preferences or fetch and cache them
    let invitationPreferences = preferencesCache.get(existingUser.id);
    if (!invitationPreferences) {
      invitationPreferences = await getOrCreateNotificationPreferences(existingUser.id);
      preferencesCache.set(existingUser.id, invitationPreferences);
    }
    await createNotification({
      userId: existingUser.id,
      type: 'INVITATION',
      title: 'Workspace invitation',
      message: `You have been invited to join ${workspace.name} as a ${role === 'ADMIN' ? 'an Admin' : 'Member'}.`,
      invitationId: invitation.id,
    }, invitationPreferences);
  }

  // The raw token is returned to the caller exactly once, here, so it can
  // be surfaced as a copyable link. It is never persisted or retrievable
  // again afterward — only its hash lives in the DB.
  return { invitation, inviteUrl: buildInviteUrl(token) };
}

/**
 * Lists a workspace's still-pending (status === INVITED) invitations, for
 * the "Pending Invitations" section of the members page. Only OWNER/ADMIN
 * may see who has outstanding invites.
 */
export async function listPendingInvitations(actorId, workspaceId) {
  await assertWorkspaceRole(actorId, workspaceId, ['OWNER', 'ADMIN']);
  return prisma.invitation.findMany({
    where: { workspaceId, status: 'INVITED' },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      expiresAt: true,
      createdAt: true,
    },
  });
}

async function getOwnedPendingInvitation(actorId, workspaceId, invitationId) {
  await assertWorkspaceRole(actorId, workspaceId, ['OWNER', 'ADMIN']);
  const invitation = await prisma.invitation.findUnique({ where: { id: invitationId } });
  if (!invitation || invitation.workspaceId !== workspaceId) {
    throw new NotFoundError('Invitation not found', 'INVITATION_NOT_FOUND');
  }
  return invitation;
}

/**
 * Cancels a pending invitation. Modeled as a status transition (not a
 * delete) so the activity/history trail stays intact.
 */
export async function cancelInvitation(actorId, workspaceId, invitationId) {
  const invitation = await getOwnedPendingInvitation(actorId, workspaceId, invitationId);
  if (invitation.status !== 'INVITED') {
    throw new BadRequestError('Only a pending invitation can be canceled', 'INVITATION_NOT_PENDING');
  }
  const updated = await prisma.invitation.update({
    where: { id: invitation.id },
    data: { status: 'DECLINED' },
  });
  await logActivity({
    workspaceId,
    userId: actorId,
    action: 'INVITATION_CANCELED',
    metadata: { email: invitation.email },
    isAudit: true,
  });
  return updated;
}

/**
 * Resends a pending invitation: issues a fresh token (old one is
 * invalidated since only the hash is stored and it's overwritten) and a
 * fresh expiry, then re-sends the email. Returns a new inviteUrl exactly
 * once, same as creation.
 */
export async function resendInvitation(actorId, workspaceId, invitationId) {
  const invitation = await getOwnedPendingInvitation(actorId, workspaceId, invitationId);
  if (invitation.status !== 'INVITED') {
    throw new BadRequestError('Only a pending invitation can be resent', 'INVITATION_NOT_PENDING');
  }

  const { token, tokenHash } = generateResetToken();
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });

  const updated = await prisma.invitation.update({
    where: { id: invitation.id },
    data: { tokenHash, expiresAt: new Date(Date.now() + INVITATION_TTL_MS) },
  });

  await sendWorkspaceInvitationEmail(invitation.email, workspace.name, buildInviteUrl(token), invitation.role);
  await logActivity({
    workspaceId,
    userId: actorId,
    action: 'INVITATION_RESENT',
    metadata: { email: invitation.email },
  });

  return { invitation: updated, inviteUrl: buildInviteUrl(token) };
}

/**
 * Loads an invitation by its raw token, hashing it before lookup (same
 * principle as password reset). Also auto-expires it if past `expiresAt`,
 * so an old link never lets someone sneak in after expiry.
 */
async function findInvitationByToken(rawToken) {
  const tokenHash = hashResetToken(rawToken);
  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash },
    include: { workspace: { select: { id: true, name: true } } },
  });
  if (!invitation) {
    throw new NotFoundError('Invitation not found', 'INVITATION_NOT_FOUND');
  }

  if (invitation.status === 'INVITED' && invitation.expiresAt < new Date()) {
    await prisma.invitation.update({ where: { id: invitation.id }, data: { status: 'EXPIRED' } });
    invitation.status = 'EXPIRED';
  }

  return invitation;
}

export async function getInvitationByToken(rawToken) {
  const invitation = await findInvitationByToken(rawToken);
  // Don't leak invitedBy internals; just enough for the accept-invite UI.
  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    status: invitation.status,
    expiresAt: invitation.expiresAt,
    workspace: invitation.workspace,
  };
}

/**
 * Loads an invitation by ID for the currently authenticated user — used by
 * the in-app invitation notification flow, which deliberately never has
 * the raw token (only `invitationId` is stored on the Notification). Only
 * the invited email's own account may view it, so this can't be used to
 * probe other people's invitations by guessing IDs.
 */
export async function getInvitationById(userEmail, invitationId) {
  const invitation = await prisma.invitation.findUnique({
    where: { id: invitationId },
    include: { workspace: { select: { id: true, name: true } } },
  });
  if (!invitation || invitation.email !== userEmail) {
    // 404 either way — don't reveal whether an invitation with this ID
    // exists at all to someone it wasn't addressed to.
    throw new NotFoundError('Invitation not found', 'INVITATION_NOT_FOUND');
  }

  if (invitation.status === 'INVITED' && invitation.expiresAt < new Date()) {
    await prisma.invitation.update({ where: { id: invitation.id }, data: { status: 'EXPIRED' } });
    invitation.status = 'EXPIRED';
  }

  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    status: invitation.status,
    expiresAt: invitation.expiresAt,
    workspace: invitation.workspace,
  };
}

/**
 * Core accept logic shared by the token-based and ID-based entry points
 * below — everything after "we have a loaded, not-yet-expired invitation
 * row" is identical regardless of how it was looked up.
 */
async function acceptLoadedInvitation(userId, userEmail, invitation) {
  if (invitation.status !== 'INVITED') {
    throw new BadRequestError(
      `This invitation is ${invitation.status.toLowerCase()} and can no longer be accepted`,
      'INVITATION_NOT_ACCEPTABLE'
    );
  }

  // The invitation was addressed to a specific email — require the logged
  // in account to match it, so a token/ID can't be redeemed by anyone who
  // merely intercepts the link or notification.
  if (invitation.email !== userEmail) {
    throw new BadRequestError(
      'This invitation was sent to a different email address',
      'INVITATION_EMAIL_MISMATCH'
    );
  }

  const existingMembership = await getWorkspaceMembership(userId, invitation.workspaceId);
  if (existingMembership) {
    throw new ConflictError('You are already a member of this workspace', 'ALREADY_MEMBER');
  }

  // Cache notification preferences by userId to avoid repeated DB fetches
  const preferencesCache = new Map();

  const membership = await prisma.$transaction(async (tx) => {
    const created = await tx.workspaceMember.create({
      data: { workspaceId: invitation.workspaceId, userId, role: invitation.role },
    });
    await tx.invitation.update({
      where: { id: invitation.id },
      data: { status: 'ACCEPTED', acceptedAt: new Date() },
    });
    return created;
  });

  await logActivity({
    workspaceId: invitation.workspaceId,
    userId,
    action: 'USER_JOINED_WORKSPACE',
    metadata: { role: invitation.role },
  });

  // Get cached preferences or fetch and cache them
  let inviterPreferences = preferencesCache.get(invitation.invitedBy);
  if (!inviterPreferences) {
    inviterPreferences = await getOrCreateNotificationPreferences(invitation.invitedBy);
    preferencesCache.set(invitation.invitedBy, inviterPreferences);
  }
  await createNotification({
    userId: invitation.invitedBy,
    type: 'INVITATION',
    title: 'Invitation accepted',
    message: `${userEmail} joined ${invitation.workspace.name}.`,
  }, inviterPreferences);

  return { membership, workspace: invitation.workspace };
}

/**
 * Accepts an invitation for the currently authenticated user. The role
 * applied is always the one the inviter set — the accepting user has no
 * way to influence it, by design.
 */
export async function acceptInvitation(userId, userEmail, rawToken) {
  const invitation = await findInvitationByToken(rawToken);
  return acceptLoadedInvitation(userId, userEmail, invitation);
}

/**
 * Same acceptance, entered from an invitation ID (the in-app notification
 * flow) instead of a raw token.
 */
export async function acceptInvitationById(userId, userEmail, invitationId) {
  const invitation = await prisma.invitation.findUnique({
    where: { id: invitationId },
    include: { workspace: { select: { id: true, name: true } } },
  });
  if (!invitation || invitation.email !== userEmail) {
    throw new NotFoundError('Invitation not found', 'INVITATION_NOT_FOUND');
  }
  if (invitation.status === 'INVITED' && invitation.expiresAt < new Date()) {
    await prisma.invitation.update({ where: { id: invitation.id }, data: { status: 'EXPIRED' } });
    invitation.status = 'EXPIRED';
  }
  return acceptLoadedInvitation(userId, userEmail, invitation);
}

/**
 * Declines an invitation for the currently authenticated user. Must match the
 * invited email to prevent an attacker from using the token URL to decline
 * someone else's invitation without authorization.
 */
export async function declineInvitation(userId, userEmail, rawToken) {
  const invitation = await findInvitationByToken(rawToken);

  // The invitation was addressed to a specific email — require the logged
  // in account to match it, same as acceptance, so a token can't be used
  // maliciously to block someone else's invite.
  if (invitation.email !== userEmail) {
    throw new BadRequestError(
      'This invitation was sent to a different email address',
      'INVITATION_EMAIL_MISMATCH'
    );
  }

  if (invitation.status !== 'INVITED') {
    throw new BadRequestError(
      `This invitation is ${invitation.status.toLowerCase()} and can no longer be declined`,
      'INVITATION_NOT_ACTIONABLE'
    );
  }

  await prisma.invitation.update({ where: { id: invitation.id }, data: { status: 'DECLINED' } });
  await logActivity({
    workspaceId: invitation.workspaceId,
    userId,
    action: 'INVITATION_DECLINED',
    metadata: { email: invitation.email },
  });
}
