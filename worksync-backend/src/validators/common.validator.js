import { z } from 'zod';

export const uuidSchema = z.string().uuid('Must be a valid UUID');

export const paramsWithIdSchema = z.object({
  id: uuidSchema,
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

// Shared filters for activity/audit history endpoints (workspace, project,
// task). All optional — an empty query still returns the full, unfiltered
// list.
export const activityFilterSchema = paginationSchema.extend({
  actorId: uuidSchema.optional(),
  action: z.string().trim().min(1).max(100).optional(),
  isAudit: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});
