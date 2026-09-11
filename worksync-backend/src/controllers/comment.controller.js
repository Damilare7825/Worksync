import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import * as commentService from '../services/comment.service.js';
import { getPaginationParams, buildPaginationMeta } from '../utils/pagination.js';

export const create = asyncHandler(async (req, res) => {
  const comment = await commentService.createComment(req.user.id, req.params.taskId, req.body);
  return sendSuccess(res, { statusCode: 201, message: 'Comment added', data: { comment } });
});

export const list = asyncHandler(async (req, res) => {
  const { page, limit, skip, take } = getPaginationParams(req.query);
  const { items, total } = await commentService.listComments(req.user.id, req.params.taskId, { skip, take });
  return sendSuccess(res, {
    message: 'Comments retrieved',
    data: { comments: items },
    meta: buildPaginationMeta({ page, limit, total }),
  });
});

export const update = asyncHandler(async (req, res) => {
  const comment = await commentService.updateComment(req.user.id, req.params.id, req.body);
  return sendSuccess(res, { message: 'Comment updated', data: { comment } });
});

export const remove = asyncHandler(async (req, res) => {
  await commentService.deleteComment(req.user.id, req.params.id);
  return sendSuccess(res, { message: 'Comment deleted', data: null });
});

export const addReaction = asyncHandler(async (req, res) => {
  const reaction = await commentService.addReaction(req.user.id, req.params.id, req.body.emoji);
  return sendSuccess(res, { statusCode: 201, message: 'Reaction added', data: { reaction } });
});

export const removeReaction = asyncHandler(async (req, res) => {
  await commentService.removeReaction(req.user.id, req.params.id, req.params.emoji);
  return sendSuccess(res, { message: 'Reaction removed', data: null });
});

export const resolve = asyncHandler(async (req, res) => {
  const comment = await commentService.resolveDiscussion(req.user.id, req.params.id);
  return sendSuccess(res, { message: 'Discussion resolved', data: { comment } });
});

export const reopen = asyncHandler(async (req, res) => {
  const comment = await commentService.reopenDiscussion(req.user.id, req.params.id);
  return sendSuccess(res, { message: 'Discussion reopened', data: { comment } });
});
