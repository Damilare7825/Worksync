import { z } from 'zod';

const TaskStatusEnum = z.enum(['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED']);
const TaskPriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().trim().max(5000).optional(),
  // Deliberately typed to only accept `undefined` (i.e. the key must be
  // absent) rather than simply omitted from the schema — see updateTask's
  // status handling in task.service.js for why a create-time status is
  // rejected outright rather than silently stripped.
  status: z.undefined(),
  priority: TaskPriorityEnum.optional(),
  dueDate: z.coerce.date().optional(),
  assigneeId: z.string().uuid('Must be a valid user ID').optional(),
  parentTaskId: z.string().uuid('Must be a valid task ID').optional(),
});

export const updateTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(5000).optional().nullable(),
    status: TaskStatusEnum.optional(),
    priority: TaskPriorityEnum.optional(),
    dueDate: z.coerce.date().optional().nullable(),
    assigneeId: z.string().uuid('Must be a valid user ID').optional().nullable(),
    parentTaskId: z.string().uuid('Must be a valid task ID').optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });

export const taskFilterSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  projectId: z.string().uuid().optional(),
  status: TaskStatusEnum.optional(),
  priority: TaskPriorityEnum.optional(),
  assigneeId: z.string().uuid().optional(),
  labelId: z.string().uuid().optional(),
  dueFrom: z.coerce.date().optional(),
  dueTo: z.coerce.date().optional(),
  includeSubtasks: z.enum(['true', 'false']).optional().transform((v) => v === 'true'),
  sortBy: z.enum(['createdAt', 'updatedAt', 'dueDate', 'title', 'position', 'priority', 'status']).optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
});

export const moveTaskSchema = z.object({
  status: TaskStatusEnum.optional(),
  beforeTaskId: z.string().uuid().optional().nullable(),
});

export const bulkUpdateTasksSchema = z
  .object({
    taskIds: z.array(z.string().uuid()).min(1).max(50),
    status: TaskStatusEnum.optional(),
    priority: TaskPriorityEnum.optional(),
    assigneeId: z.string().uuid().optional().nullable(),
    dueDate: z.coerce.date().optional().nullable(),
    addLabelId: z.string().uuid().optional(),
    removeLabelId: z.string().uuid().optional(),
  })
  .refine(
    (data) =>
      data.status !== undefined ||
      data.priority !== undefined ||
      data.assigneeId !== undefined ||
      data.dueDate !== undefined ||
      data.addLabelId !== undefined ||
      data.removeLabelId !== undefined,
    { message: 'At least one update field must be provided' }
  );
