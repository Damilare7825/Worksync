import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import * as workspaceService from '../services/workspace.service.js';

// Preview doesn't require auth — same reasoning as previewing an
// email invitation by token: the user should be able to see "You're
// about to join X" before being forced to log in.
export const preview = asyncHandler(async (req, res) => {
  const workspace = await workspaceService.getWorkspaceByInviteLinkToken(req.params.token);
  return sendSuccess(res, { message: 'Invite link retrieved', data: { workspace } });
});

export const join = asyncHandler(async (req, res) => {
  const result = await workspaceService.joinViaInviteLink(req.user.id, req.params.token);
  return sendSuccess(res, { message: 'Joined workspace', data: result });
});
