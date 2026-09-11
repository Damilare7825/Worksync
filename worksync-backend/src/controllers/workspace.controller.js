import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import * as workspaceService from '../services/workspace.service.js';
import { getPaginationParams, buildPaginationMeta } from '../utils/pagination.js';

export const create = asyncHandler(async (req, res) => {
  const workspace = await workspaceService.createWorkspace(req.user.id, req.body);
  return sendSuccess(res, { statusCode: 201, message: 'Workspace created', data: { workspace } });
});

export const list = asyncHandler(async (req, res) => {
  const { page, limit, skip, take } = getPaginationParams(req.query);
  const { items, total } = await workspaceService.listUserWorkspaces(req.user.id, { skip, take });
  return sendSuccess(res, {
    message: 'Workspaces retrieved',
    data: { workspaces: items },
    meta: buildPaginationMeta({ page, limit, total }),
  });
});

export const getOne = asyncHandler(async (req, res) => {
  const workspace = await workspaceService.getWorkspace(req.user.id, req.params.id);
  return sendSuccess(res, { message: 'Workspace retrieved', data: { workspace } });
});

export const update = asyncHandler(async (req, res) => {
  const workspace = await workspaceService.updateWorkspace(req.user.id, req.params.id, req.body);
  return sendSuccess(res, { message: 'Workspace updated', data: { workspace } });
});

export const remove = asyncHandler(async (req, res) => {
  await workspaceService.deleteWorkspace(req.user.id, req.params.id);
  return sendSuccess(res, { message: 'Workspace deleted', data: null });
});

export const listMembers = asyncHandler(async (req, res) => {
  const { page, limit, skip, take } = getPaginationParams(req.query);
  const { items, total } = await workspaceService.listMembers(req.user.id, req.params.id, { skip, take });
  return sendSuccess(res, {
    message: 'Workspace members retrieved',
    data: { members: items },
    meta: buildPaginationMeta({ page, limit, total }),
  });
});

export const updateMemberRole = asyncHandler(async (req, res) => {
  const member = await workspaceService.updateMemberRole(
    req.user.id,
    req.params.id,
    req.params.memberId,
    req.body.role
  );
  return sendSuccess(res, { message: 'Member role updated', data: { member } });
});

export const removeMember = asyncHandler(async (req, res) => {
  await workspaceService.removeMember(req.user.id, req.params.id, req.params.memberId);
  return sendSuccess(res, { message: 'Member removed', data: null });
});

// ---- Shareable invite link -------------------------------------------

export const getInviteLink = asyncHandler(async (req, res) => {
  const link = await workspaceService.getInviteLink(req.user.id, req.params.id);
  return sendSuccess(res, { message: 'Invite link retrieved', data: link });
});

export const enableInviteLink = asyncHandler(async (req, res) => {
  const link = await workspaceService.enableInviteLink(req.user.id, req.params.id, req.body);
  return sendSuccess(res, { message: 'Invite link enabled', data: link });
});

export const disableInviteLink = asyncHandler(async (req, res) => {
  await workspaceService.disableInviteLink(req.user.id, req.params.id);
  return sendSuccess(res, { message: 'Invite link disabled', data: null });
});

export const regenerateInviteLink = asyncHandler(async (req, res) => {
  const link = await workspaceService.regenerateInviteLink(req.user.id, req.params.id);
  return sendSuccess(res, { message: 'Invite link regenerated', data: link });
});
