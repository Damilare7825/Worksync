import { Router } from 'express';
import * as teamController from '../controllers/team.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validation.middleware.js';
import { createTeamSchema, updateTeamSchema, addTeamMemberSchema } from '../validators/team.validator.js';
import { paramsWithIdSchema } from '../validators/common.validator.js';
import { z } from 'zod';

// Mounted twice from app.js: once under /workspaces/:workspaceId/teams
// (create/list) and once flat under /teams/:id (single-resource ops), to
// match the spec's API structure exactly.

export const workspaceScopedRouter = Router({ mergeParams: true });
workspaceScopedRouter.use(authenticate);
workspaceScopedRouter.post(
  '/',
  validate({
    params: z.object({ workspaceId: paramsWithIdSchema.shape.id }),
    body: createTeamSchema,
  }),
  teamController.create
);
workspaceScopedRouter.get(
  '/',
  validate({ params: z.object({ workspaceId: paramsWithIdSchema.shape.id }) }),
  teamController.list
);

export const flatRouter = Router();
flatRouter.use(authenticate);
flatRouter.get('/:id', validate({ params: paramsWithIdSchema }), teamController.getOne);
flatRouter.patch(
  '/:id',
  validate({ params: paramsWithIdSchema, body: updateTeamSchema }),
  teamController.update
);
flatRouter.delete('/:id', validate({ params: paramsWithIdSchema }), teamController.remove);
flatRouter.post(
  '/:teamId/members',
  validate({
    params: z.object({ teamId: paramsWithIdSchema.shape.id }),
    body: addTeamMemberSchema,
  }),
  teamController.addMember
);
flatRouter.delete(
  '/:teamId/members/:userId',
  validate({
    params: z.object({ teamId: paramsWithIdSchema.shape.id, userId: paramsWithIdSchema.shape.id }),
  }),
  teamController.removeMember
);
