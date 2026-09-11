import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import * as taskService from '../services/task.service.js';
import { getPaginationParams, buildPaginationMeta } from '../utils/pagination.js';

export const create = asyncHandler(async (req, res) => {
  const task = await taskService.createTask(req.user.id, req.params.projectId, req.body);
  return sendSuccess(res, { statusCode: 201, message: 'Task created', data: { task } });
});

export const list = asyncHandler(async (req, res) => {
  const { page, limit, skip, take } = getPaginationParams(req.query);
  const { status, priority, assigneeId, labelId, includeSubtasks, sortBy, sortDir } = req.query;
  const { items, total } = await taskService.listTasks(
    req.user.id,
    req.params.projectId,
    { status, priority, assigneeId, labelId, includeSubtasks, sortBy, sortDir },
    { skip, take }
  );
  return sendSuccess(res, {
    message: 'Tasks retrieved',
    data: { tasks: items },
    meta: buildPaginationMeta({ page, limit, total }),
  });
});

export const listByWorkspace = asyncHandler(async (req, res) => {
  const { page, limit, skip, take } = getPaginationParams(req.query);
  const filters = {
    status: req.query.status,
    priority: req.query.priority,
    assigneeId: req.query.assigneeId,
    labelId: req.query.labelId,
    projectId: req.query.projectId,
    dueFrom: req.query.dueFrom,
    dueTo: req.query.dueTo,
    includeSubtasks: req.query.includeSubtasks,
    sortBy: req.query.sortBy,
    sortDir: req.query.sortDir,
  };
  const { items, total } = await taskService.listWorkspaceTasks(
    req.user.id,
    req.params.workspaceId,
    filters,
    { skip, take }
  );
  return sendSuccess(res, {
    message: 'Workspace tasks retrieved',
    data: { tasks: items },
    meta: buildPaginationMeta({ page, limit, total }),
  });
});

export const getOne = asyncHandler(async (req, res) => {
  const task = await taskService.getTask(req.user.id, req.params.id);
  return sendSuccess(res, { message: 'Task retrieved', data: { task } });
});

export const update = asyncHandler(async (req, res) => {
  const task = await taskService.updateTask(req.user.id, req.params.id, req.body);
  return sendSuccess(res, { message: 'Task updated', data: { task } });
});

export const remove = asyncHandler(async (req, res) => {
  await taskService.deleteTask(req.user.id, req.params.id);
  return sendSuccess(res, { message: 'Task deleted', data: null });
});

export const move = asyncHandler(async (req, res) => {
  const task = await taskService.moveTask(req.user.id, req.params.id, req.body);
  return sendSuccess(res, { message: 'Task moved', data: { task } });
});

export const bulkUpdate = asyncHandler(async (req, res) => {
  const result = await taskService.bulkUpdateTasks(req.user.id, req.body);
  return sendSuccess(res, { message: 'Tasks updated in bulk', data: result });
});
