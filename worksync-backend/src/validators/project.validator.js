import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string().trim().min(2, 'Project name must be at least 2 characters').max(150),
  description: z.string().trim().max(2000).optional(),
  startDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional(),
});

export const updateProjectSchema = z
  .object({
    name: z.string().trim().min(2).max(150).optional(),
    description: z.string().trim().max(2000).optional().nullable(),
    status: z.enum(['ACTIVE', 'COMPLETED', 'ARCHIVED']).optional(),
    startDate: z.coerce.date().optional().nullable(),
    dueDate: z.coerce.date().optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });

// A project member is added with MANAGER or MEMBER — never OWNER/ADMIN,
// which are workspace-level concepts and don't apply at the project level.
export const addProjectMemberSchema = z.object({
  userId: z.string().uuid('Must be a valid user ID'),
  role: z.enum(['MANAGER', 'MEMBER']).default('MEMBER'),
});

export const updateProjectMemberSchema = z.object({
  role: z.enum(['MANAGER', 'MEMBER']),
});

export const restoreProjectSchema = z
  .object({
    status: z.enum(['ACTIVE', 'COMPLETED']).default('ACTIVE'),
  })
  .optional();

export const projectListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'ARCHIVED']).optional(),
});
