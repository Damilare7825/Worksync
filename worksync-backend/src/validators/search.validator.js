import { z } from 'zod';

export const searchQuerySchema = z.object({
  workspaceId: z.string().uuid('Must be a valid workspace ID'),
  q: z.string().trim().max(200).optional().default(''),
  type: z.enum(['ALL', 'TASKS', 'PROJECTS', 'DISCUSSIONS', 'MEMBERS', 'WORKSPACES']).optional().default('ALL'),
  projectId: z.string().uuid().optional(),
  status: z.enum(['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED', 'ACTIVE', 'ARCHIVED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  assigneeId: z.string().uuid().optional(),
  labelId: z.string().uuid().optional(),
  authorId: z.string().uuid().optional(),
  watcherId: z.string().uuid().optional(),
  dueFrom: z.coerce.date().optional(),
  dueTo: z.coerce.date().optional(),
  archived: z.enum(['true', 'false']).optional().transform((val) => (val === undefined ? undefined : val === 'true')),
  resolved: z.enum(['true', 'false']).optional().transform((val) => (val === undefined ? undefined : val === 'true')),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
});

export const suggestionQuerySchema = z.object({
  workspaceId: z.string().uuid('Must be a valid workspace ID'),
  q: z.string().trim().max(100).optional().default(''),
});
