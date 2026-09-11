import { z } from 'zod';

export const checklistItemCreateSchema = z.object({
  text: z.string().trim().min(1, 'Text is required').max(500),
});

export const checklistItemUpdateSchema = z
  .object({
    text: z.string().trim().min(1).max(500).optional(),
    completed: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });

export const checklistReorderSchema = z.object({
  itemIds: z.array(z.string().uuid()).min(1),
});

export const dependencyCreateSchema = z.object({
  dependsOnTaskId: z.string().uuid('Must be a valid task ID'),
});

export const recurrenceSchema = z.object({
  pattern: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
  interval: z.coerce.number().int().positive().max(365).optional(),
  timezone: z.string().trim().max(64).optional(),
});

export const labelCreateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(50),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a hex value like #6366F1')
    .optional(),
});

export const taskLabelAssignSchema = z.object({
  labelId: z.string().uuid('Must be a valid label ID'),
});
