import { Router } from 'express';
import * as commentController from '../controllers/comment.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validation.middleware.js';
import { createCommentSchema, updateCommentSchema, reactionSchema } from '../validators/comment.validator.js';
import { paramsWithIdSchema, paginationSchema } from '../validators/common.validator.js';
import { z } from 'zod';

export const taskScopedRouter = Router({ mergeParams: true });
taskScopedRouter.use(authenticate);
taskScopedRouter.post(
  '/',
  validate({
    params: z.object({ taskId: paramsWithIdSchema.shape.id }),
    body: createCommentSchema,
  }),
  commentController.create
);
taskScopedRouter.get(
  '/',
  validate({ params: z.object({ taskId: paramsWithIdSchema.shape.id }), query: paginationSchema }),
  commentController.list
);

export const flatRouter = Router();
flatRouter.use(authenticate);
flatRouter.patch(
  '/:id',
  validate({ params: paramsWithIdSchema, body: updateCommentSchema }),
  commentController.update
);
flatRouter.delete('/:id', validate({ params: paramsWithIdSchema }), commentController.remove);

flatRouter.post(
  '/:id/reactions',
  validate({ params: paramsWithIdSchema, body: reactionSchema }),
  commentController.addReaction
);
flatRouter.delete(
  '/:id/reactions/:emoji',
  validate({ params: paramsWithIdSchema.extend({ emoji: z.string().min(1) }) }),
  commentController.removeReaction
);
flatRouter.post('/:id/resolve', validate({ params: paramsWithIdSchema }), commentController.resolve);
flatRouter.post('/:id/reopen', validate({ params: paramsWithIdSchema }), commentController.reopen);
