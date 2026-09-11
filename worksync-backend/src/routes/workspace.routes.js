import { Router } from 'express';
import * as workspaceController from '../controllers/workspace.controller.js';
import * as invitationController from '../controllers/invitation.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validation.middleware.js';
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  updateMemberRoleSchema,
  enableInviteLinkSchema,
} from '../validators/workspace.validator.js';
import { createInvitationSchema } from '../validators/invitation.validator.js';
import { paramsWithIdSchema, paginationSchema } from '../validators/common.validator.js';
import { z } from 'zod';

const router = Router();

router.use(authenticate);

router.post('/', validate({ body: createWorkspaceSchema }), workspaceController.create);
router.get('/', validate({ query: paginationSchema }), workspaceController.list);
router.get('/:id', validate({ params: paramsWithIdSchema }), workspaceController.getOne);
router.patch(
  '/:id',
  validate({ params: paramsWithIdSchema, body: updateWorkspaceSchema }),
  workspaceController.update
);
router.delete('/:id', validate({ params: paramsWithIdSchema }), workspaceController.remove);

router.get(
  '/:id/members',
  validate({ params: paramsWithIdSchema, query: paginationSchema }),
  workspaceController.listMembers
);
router.patch(
  '/:id/members/:memberId',
  validate({
    params: z.object({ id: paramsWithIdSchema.shape.id, memberId: paramsWithIdSchema.shape.id }),
    body: updateMemberRoleSchema,
  }),
  workspaceController.updateMemberRole
);
router.delete(
  '/:id/members/:memberId',
  validate({
    params: z.object({ id: paramsWithIdSchema.shape.id, memberId: paramsWithIdSchema.shape.id }),
  }),
  workspaceController.removeMember
);

router.post(
  '/:id/invitations',
  validate({ params: paramsWithIdSchema, body: createInvitationSchema }),
  invitationController.create
);
router.get(
  '/:id/invitations/pending',
  validate({ params: paramsWithIdSchema }),
  invitationController.listPending
);
router.post(
  '/:id/invitations/:invitationId/resend',
  validate({
    params: z.object({ id: paramsWithIdSchema.shape.id, invitationId: paramsWithIdSchema.shape.id }),
  }),
  invitationController.resend
);
router.delete(
  '/:id/invitations/:invitationId',
  validate({
    params: z.object({ id: paramsWithIdSchema.shape.id, invitationId: paramsWithIdSchema.shape.id }),
  }),
  invitationController.cancel
);

// ---- Shareable invite link (second, non-email-bound way to invite) ----
router.get(
  '/:id/invite-link',
  validate({ params: paramsWithIdSchema }),
  workspaceController.getInviteLink
);
router.post(
  '/:id/invite-link/enable',
  validate({ params: paramsWithIdSchema, body: enableInviteLinkSchema }),
  workspaceController.enableInviteLink
);
router.post(
  '/:id/invite-link/disable',
  validate({ params: paramsWithIdSchema }),
  workspaceController.disableInviteLink
);
router.post(
  '/:id/invite-link/regenerate',
  validate({ params: paramsWithIdSchema }),
  workspaceController.regenerateInviteLink
);

export default router;
