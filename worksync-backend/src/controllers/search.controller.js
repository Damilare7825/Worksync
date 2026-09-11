import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import * as searchService from '../services/search.service.js';

export const search = asyncHandler(async (req, res) => {
  const {
    workspaceId,
    q,
    type,
    projectId,
    status,
    priority,
    assigneeId,
    labelId,
    authorId,
    resolved,
    page,
    limit,
  } = req.query;

  const results = await searchService.globalSearch(req.user.id, workspaceId, {
    q,
    type,
    projectId,
    status,
    priority,
    assigneeId,
    labelId,
    authorId,
    resolved,
    page,
    limit,
  });

  return sendSuccess(res, { message: 'Search results retrieved', data: results });
});

export const suggestions = asyncHandler(async (req, res) => {
  const { workspaceId, q } = req.query;
  const results = await searchService.getSuggestions(req.user.id, workspaceId, q || '');
  return sendSuccess(res, { message: 'Search suggestions retrieved', data: results });
});
