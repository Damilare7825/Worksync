import { Router } from 'express';
import * as projectController from '../controllers/project.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validation.middleware.js';
import {
  createProjectSchema,
  updateProjectSchema,
  addProjectMemberSchema,
  updateProjectMemberSchema,
  restoreProjectSchema,
  projectListQuerySchema,
} from '../validators/project.validator.js';
import { paramsWithIdSchema } from '../validators/common.validator.js';
import { z } from 'zod';

export const workspaceScopedRouter = Router({ mergeParams: true });
workspaceScopedRouter.use(authenticate);
workspaceScopedRouter.post(
  '/',
  validate({
    params: z.object({ workspaceId: paramsWithIdSchema.shape.id }),
    body: createProjectSchema,
  }),
  projectController.create
);
workspaceScopedRouter.get(
  '/',
  validate({
    params: z.object({ workspaceId: paramsWithIdSchema.shape.id }),
    query: projectListQuerySchema,
  }),
  projectController.list
);

export const flatRouter = Router();
flatRouter.use(authenticate);
flatRouter.get('/:id', validate({ params: paramsWithIdSchema }), projectController.getOne);
flatRouter.patch(
  '/:id',
  validate({ params: paramsWithIdSchema, body: updateProjectSchema }),
  projectController.update
);
flatRouter.delete('/:id', validate({ params: paramsWithIdSchema }), projectController.remove);
flatRouter.post('/:id/archive', validate({ params: paramsWithIdSchema }), projectController.archive);
flatRouter.post(
  '/:id/restore',
  validate({ params: paramsWithIdSchema, body: restoreProjectSchema }),
  projectController.restore
);
flatRouter.get('/:id/stats', validate({ params: paramsWithIdSchema }), projectController.stats);

flatRouter.get(
  '/:projectId/members',
  validate({ params: z.object({ projectId: paramsWithIdSchema.shape.id }) }),
  projectController.listMembers
);
flatRouter.post(
  '/:projectId/members',
  validate({
    params: z.object({ projectId: paramsWithIdSchema.shape.id }),
    body: addProjectMemberSchema,
  }),
  projectController.addMember
);
flatRouter.patch(
  '/:projectId/members/:memberId',
  validate({
    params: z.object({
      projectId: paramsWithIdSchema.shape.id,
      memberId: paramsWithIdSchema.shape.id,
    }),
    body: updateProjectMemberSchema,
  }),
  projectController.updateMember
);
flatRouter.delete(
  '/:projectId/members/:memberId',
  validate({
    params: z.object({
      projectId: paramsWithIdSchema.shape.id,
      memberId: paramsWithIdSchema.shape.id,
    }),
  }),
  projectController.removeMember
);
