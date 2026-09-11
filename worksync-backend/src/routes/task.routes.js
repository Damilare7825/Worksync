import { Router } from 'express';
import * as taskController from '../controllers/task.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validation.middleware.js';
import { createTaskSchema, updateTaskSchema, taskFilterSchema, moveTaskSchema, bulkUpdateTasksSchema } from '../validators/task.validator.js';
import { paramsWithIdSchema } from '../validators/common.validator.js';
import { z } from 'zod';

export const workspaceScopedRouter = Router({ mergeParams: true });
workspaceScopedRouter.use(authenticate);
workspaceScopedRouter.get(
  '/',
  validate({
    params: z.object({ workspaceId: paramsWithIdSchema.shape.id }),
    query: taskFilterSchema,
  }),
  taskController.listByWorkspace
);

export const projectScopedRouter = Router({ mergeParams: true });
projectScopedRouter.use(authenticate);
projectScopedRouter.post(
  '/',
  validate({
    params: z.object({ projectId: paramsWithIdSchema.shape.id }),
    body: createTaskSchema,
  }),
  taskController.create
);
projectScopedRouter.get(
  '/',
  validate({
    params: z.object({ projectId: paramsWithIdSchema.shape.id }),
    query: taskFilterSchema,
  }),
  taskController.list
);

export const flatRouter = Router();
flatRouter.use(authenticate);
flatRouter.post(
  '/bulk',
  validate({ body: bulkUpdateTasksSchema }),
  taskController.bulkUpdate
);
flatRouter.get('/:id', validate({ params: paramsWithIdSchema }), taskController.getOne);
flatRouter.patch(
  '/:id',
  validate({ params: paramsWithIdSchema, body: updateTaskSchema }),
  taskController.update
);
flatRouter.patch(
  '/:id/move',
  validate({ params: paramsWithIdSchema, body: moveTaskSchema }),
  taskController.move
);
flatRouter.delete('/:id', validate({ params: paramsWithIdSchema }), taskController.remove);

