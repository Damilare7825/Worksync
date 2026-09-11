import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import * as projectService from '../services/project.service.js';
import { getPaginationParams, buildPaginationMeta } from '../utils/pagination.js';

export const create = asyncHandler(async (req, res) => {
  const project = await projectService.createProject(req.user.id, req.params.workspaceId, req.body);
  return sendSuccess(res, { statusCode: 201, message: 'Project created', data: { project } });
});

export const list = asyncHandler(async (req, res) => {
  const { page, limit, skip, take } = getPaginationParams(req.query);
  const { items, total } = await projectService.listProjects(
    req.user.id,
    req.params.workspaceId,
    { skip, take },
    { status: req.query.status }
  );
  return sendSuccess(res, {
    message: 'Projects retrieved',
    data: { projects: items },
    meta: buildPaginationMeta({ page, limit, total }),
  });
});

export const getOne = asyncHandler(async (req, res) => {
  const project = await projectService.getProject(req.user.id, req.params.id);
  return sendSuccess(res, { message: 'Project retrieved', data: { project } });
});

export const update = asyncHandler(async (req, res) => {
  const project = await projectService.updateProject(req.user.id, req.params.id, req.body);
  return sendSuccess(res, { message: 'Project updated', data: { project } });
});

export const remove = asyncHandler(async (req, res) => {
  await projectService.deleteProject(req.user.id, req.params.id);
  return sendSuccess(res, { message: 'Project deleted', data: null });
});

export const archive = asyncHandler(async (req, res) => {
  const project = await projectService.archiveProject(req.user.id, req.params.id);
  return sendSuccess(res, { message: 'Project archived', data: { project } });
});

export const restore = asyncHandler(async (req, res) => {
  const project = await projectService.restoreProject(req.user.id, req.params.id, req.body?.status);
  return sendSuccess(res, { message: 'Project restored', data: { project } });
});

export const stats = asyncHandler(async (req, res) => {
  const projectStats = await projectService.getProjectStats(req.user.id, req.params.id);
  return sendSuccess(res, { message: 'Project stats retrieved', data: { stats: projectStats } });
});

export const listMembers = asyncHandler(async (req, res) => {
  const members = await projectService.listProjectMembers(req.user.id, req.params.projectId);
  return sendSuccess(res, { message: 'Project members retrieved', data: { members } });
});

export const addMember = asyncHandler(async (req, res) => {
  const member = await projectService.addProjectMember(req.user.id, req.params.projectId, req.body);
  return sendSuccess(res, { statusCode: 201, message: 'Project member added', data: { member } });
});

export const updateMember = asyncHandler(async (req, res) => {
  const member = await projectService.updateProjectMember(
    req.user.id,
    req.params.projectId,
    req.params.memberId,
    req.body.role
  );
  return sendSuccess(res, { message: 'Project member updated', data: { member } });
});

export const removeMember = asyncHandler(async (req, res) => {
  await projectService.removeProjectMember(req.user.id, req.params.projectId, req.params.memberId);
  return sendSuccess(res, { message: 'Project member removed', data: null });
});
