import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import * as activityService from '../services/activity.service.js';
import * as projectService from '../services/project.service.js';
import * as taskService from '../services/task.service.js';
import { assertWorkspaceMembership } from '../services/authorization.service.js';
import { getPaginationParams, buildPaginationMeta } from '../utils/pagination.js';

function extractFilters({ actorId, action, isAudit, dateFrom, dateTo }) {
  return { actorId, action, isAudit, dateFrom, dateTo };
}

export const listWorkspaceActivity = asyncHandler(async (req, res) => {
  await assertWorkspaceMembership(req.user.id, req.params.workspaceId);
  const { page, limit, skip, take } = getPaginationParams(req.query);
  const { items, total } = await activityService.listWorkspaceActivity(
    req.params.workspaceId,
    { skip, take },
    extractFilters(req.query)
  );
  return sendSuccess(res, {
    message: 'Workspace activity retrieved',
    data: { activity: items },
    meta: buildPaginationMeta({ page, limit, total }),
  });
});

export const listProjectActivity = asyncHandler(async (req, res) => {
  // getProject already enforces project access (workspace admin/owner or
  // explicit project membership).
  await projectService.getProject(req.user.id, req.params.projectId);
  const { page, limit, skip, take } = getPaginationParams(req.query);
  const { items, total } = await activityService.listProjectActivity(
    req.params.projectId,
    { skip, take },
    extractFilters(req.query)
  );
  return sendSuccess(res, {
    message: 'Project activity retrieved',
    data: { activity: items },
    meta: buildPaginationMeta({ page, limit, total }),
  });
});

export const listTaskActivity = asyncHandler(async (req, res) => {
  // getTask enforces the caller has access to the task's project.
  await taskService.getTask(req.user.id, req.params.taskId);
  const { page, limit, skip, take } = getPaginationParams(req.query);
  const { items, total } = await activityService.listTaskActivity(
    req.params.taskId,
    { skip, take },
    extractFilters(req.query)
  );
  return sendSuccess(res, {
    message: 'Task history retrieved',
    data: { activity: items },
    meta: buildPaginationMeta({ page, limit, total }),
  });
});
