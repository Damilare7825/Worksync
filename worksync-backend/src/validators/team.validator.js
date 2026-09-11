import { z } from 'zod';

export const createTeamSchema = z.object({
  name: z.string().trim().min(2, 'Team name must be at least 2 characters').max(100),
  description: z.string().trim().max(500).optional(),
});

export const updateTeamSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    description: z.string().trim().max(500).optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });

export const addTeamMemberSchema = z.object({
  userId: z.string().uuid('Must be a valid user ID'),
});
