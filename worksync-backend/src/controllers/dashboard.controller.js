import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import * as dashboardService from '../services/dashboard.service.js';
import * as analyticsService from '../services/analytics.service.js';

export const getStats = asyncHandler(async (req, res) => {
  const stats = await dashboardService.getDashboardStats(req.user.id);
  return sendSuccess(res, { message: 'Dashboard statistics retrieved', data: stats });
});

export const getPersonalAnalytics = asyncHandler(async (req, res) => {
  const analytics = await analyticsService.getPersonalAnalytics(req.user.id, req.params.workspaceId, req.query);
  return sendSuccess(res, { message: 'Personal analytics retrieved', data: { analytics } });
});

export const getWorkspaceAnalytics = asyncHandler(async (req, res) => {
  const analytics = await analyticsService.getWorkspaceAnalytics(req.user.id, req.params.workspaceId, req.query);
  return sendSuccess(res, { message: 'Workspace analytics retrieved', data: { analytics } });
});

export const getProjectAnalytics = asyncHandler(async (req, res) => {
  const analytics = await analyticsService.getProjectAnalytics(req.user.id, req.params.projectId, req.query);
  return sendSuccess(res, { message: 'Project analytics retrieved', data: { analytics } });
});
