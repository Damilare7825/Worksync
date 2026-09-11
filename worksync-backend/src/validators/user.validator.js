import { z } from 'zod';

// Explicit whitelist prevents mass-assignment of fields like id/email/passwordHash.
export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    bio: z.string().trim().max(500).optional(),
    avatar: z.string().trim().url('Avatar must be a valid URL').optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });