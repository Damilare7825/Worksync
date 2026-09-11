import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import * as labelService from '../services/label.service.js';

export const list = asyncHandler(async (req, res) => {
  const labels = await labelService.listLabels(req.user.id, req.params.workspaceId);
  return sendSuccess(res, { message: 'Labels retrieved', data: { labels } });
});

export const create = asyncHandler(async (req, res) => {
  const label = await labelService.createLabel(req.user.id, req.params.workspaceId, req.body);
  return sendSuccess(res, { statusCode: 201, message: 'Label created', data: { label } });
});

export const remove = asyncHandler(async (req, res) => {
  await labelService.deleteLabel(req.user.id, req.params.workspaceId, req.params.labelId);
  return sendSuccess(res, { message: 'Label deleted', data: null });
});
