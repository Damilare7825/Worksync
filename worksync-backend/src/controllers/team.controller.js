import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import * as teamService from '../services/team.service.js';

export const create = asyncHandler(async (req, res) => {
  const team = await teamService.createTeam(req.user.id, req.params.workspaceId, req.body);
  return sendSuccess(res, { statusCode: 201, message: 'Team created', data: { team } });
});

export const list = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const skip = page ? (Math.max(1, parseInt(page, 10)) - 1) * (parseInt(limit, 10) || 20) : undefined;
  const take = limit ? Math.min(Math.max(1, parseInt(limit, 10)), 100) : undefined;
  const teams = await teamService.listTeams(req.user.id, req.params.workspaceId, { skip, take });
  return sendSuccess(res, { message: 'Teams retrieved', data: { teams } });
});

export const getOne = asyncHandler(async (req, res) => {
  const team = await teamService.getTeam(req.user.id, req.params.id);
  return sendSuccess(res, { message: 'Team retrieved', data: { team } });
});

export const update = asyncHandler(async (req, res) => {
  const team = await teamService.updateTeam(req.user.id, req.params.id, req.body);
  return sendSuccess(res, { message: 'Team updated', data: { team } });
});

export const remove = asyncHandler(async (req, res) => {
  await teamService.deleteTeam(req.user.id, req.params.id);
  return sendSuccess(res, { message: 'Team deleted', data: null });
});

export const addMember = asyncHandler(async (req, res) => {
  const member = await teamService.addTeamMember(req.user.id, req.params.teamId, req.body.userId);
  return sendSuccess(res, { statusCode: 201, message: 'Team member added', data: { member } });
});

export const removeMember = asyncHandler(async (req, res) => {
  await teamService.removeTeamMember(req.user.id, req.params.teamId, req.params.userId);
  return sendSuccess(res, { message: 'Team member removed', data: null });
});
