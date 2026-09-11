import { z } from 'zod';

export const createInvitationSchema = z.object({
  email: z.string().trim().toLowerCase().email('Must be a valid email address'),
  role: z.enum(['ADMIN', 'MEMBER']).default('MEMBER'),
});

export const invitationTokenParamsSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});
