import { Router } from 'express';
import * as labelController from '../controllers/label.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validation.middleware.js';
import { paramsWithIdSchema } from '../validators/common.validator.js';
import { labelCreateSchema } from '../validators/taskExtras.validator.js';
import { z } from 'zod';

const workspaceIdParams = z.object({ workspaceId: paramsWithIdSchema.shape.id });

export const workspaceScopedRouter = Router({ mergeParams: true });
workspaceScopedRouter.use(authenticate);
workspaceScopedRouter.get('/', validate({ params: workspaceIdParams }), labelController.list);
workspaceScopedRouter.post(
  '/',
  validate({ params: workspaceIdParams, body: labelCreateSchema }),
  labelController.create
);
workspaceScopedRouter.delete(
  '/:labelId',
  validate({ params: workspaceIdParams.extend({ labelId: paramsWithIdSchema.shape.id }) }),
  labelController.remove
);
