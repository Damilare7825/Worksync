import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import * as invitationService from '../services/invitation.service.js';

export const create = asyncHandler(async (req, res) => {
  const { invitation, inviteUrl } = await invitationService.createInvitation(
    req.user.id,
    req.params.id,
    req.body
  );
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Invitation sent',
    data: { invitation, inviteUrl },
  });
});

export const listPending = asyncHandler(async (req, res) => {
  const invitations = await invitationService.listPendingInvitations(req.user.id, req.params.id);
  return sendSuccess(res, { message: 'Pending invitations retrieved', data: { invitations } });
});

export const cancel = asyncHandler(async (req, res) => {
  await invitationService.cancelInvitation(req.user.id, req.params.id, req.params.invitationId);
  return sendSuccess(res, { message: 'Invitation canceled', data: null });
});

export const resend = asyncHandler(async (req, res) => {
  const { invitation, inviteUrl } = await invitationService.resendInvitation(
    req.user.id,
    req.params.id,
    req.params.invitationId
  );
  return sendSuccess(res, { message: 'Invitation resent', data: { invitation, inviteUrl } });
});

export const getByToken = asyncHandler(async (req, res) => {
  const invitation = await invitationService.getInvitationByToken(req.params.token);
  return sendSuccess(res, { message: 'Invitation retrieved', data: { invitation } });
});

export const accept = asyncHandler(async (req, res) => {
  const result = await invitationService.acceptInvitation(req.user.id, req.user.email, req.params.token);
  return sendSuccess(res, { message: 'Invitation accepted', data: result });
});

export const getById = asyncHandler(async (req, res) => {
  const invitation = await invitationService.getInvitationById(req.user.email, req.params.id);
  return sendSuccess(res, { message: 'Invitation retrieved', data: { invitation } });
});

export const acceptById = asyncHandler(async (req, res) => {
  const result = await invitationService.acceptInvitationById(req.user.id, req.user.email, req.params.id);
  return sendSuccess(res, { message: 'Invitation accepted', data: result });
});

export const decline = asyncHandler(async (req, res) => {
  await invitationService.declineInvitation(req.user.id, req.user.email, req.params.token);
  return sendSuccess(res, { message: 'Invitation declined', data: null });
});
