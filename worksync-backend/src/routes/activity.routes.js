import { Router } from 'express';
import * as activityController from '../controllers/activity.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validation.middleware.js';
import { activityFilterSchema, paramsWithIdSchema } from '../validators/common.validator.js';
import { z } from 'zod';

export const workspaceScopedRouter = Router({ mergeParams: true });
workspaceScopedRouter.use(authenticate);
workspaceScopedRouter.get(
  '/',
  validate({
    params: z.object({ workspaceId: paramsWithIdSchema.shape.id }),
    query: activityFilterSchema,
  }),
  activityController.listWorkspaceActivity
);

export const projectScopedRouter = Router({ mergeParams: true });
projectScopedRouter.use(authenticate);
projectScopedRouter.get(
  '/',
  validate({
    params: z.object({ projectId: paramsWithIdSchema.shape.id }),
    query: activityFilterSchema,
  }),
  activityController.listProjectActivity
);

// Entity/task history — GET /tasks/:taskId/activity
export const taskScopedRouter = Router({ mergeParams: true });
taskScopedRouter.use(authenticate);
taskScopedRouter.get(
  '/',
  validate({
    params: z.object({ taskId: paramsWithIdSchema.shape.id }),
    query: activityFilterSchema,
  }),
  activityController.listTaskActivity
);
