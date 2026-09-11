import { z } from 'zod';

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(2, 'Workspace name must be at least 2 characters').max(100),
});

export const updateWorkspaceSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });

// A user is invited as ADMIN or MEMBER only — OWNER is never assignable via
// invitation, only via explicit ownership transfer on an existing member.
export const inviteMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email('Must be a valid email address'),
  role: z.enum(['ADMIN', 'MEMBER']).default('MEMBER'),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER']),
});

// The invite-link role only ever grants ADMIN or MEMBER, same reasoning as
// email invitations — OWNER is never handed out this way.
export const enableInviteLinkSchema = z.object({
  role: z.enum(['ADMIN', 'MEMBER']).default('MEMBER'),
});
