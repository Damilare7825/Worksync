import { Router } from 'express';
import * as invitationController from '../controllers/invitation.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validation.middleware.js';
import { invitationTokenParamsSchema } from '../validators/invitation.validator.js';
import { paramsWithIdSchema } from '../validators/common.validator.js';

const router = Router();

// ID-based routes (used by the in-app invitation notification flow, which
// only ever has invitationId — never the raw token). Mounted first and
// under a distinct '/id' prefix so they can't collide with '/:token'.
router.get('/id/:id', authenticate, validate({ params: paramsWithIdSchema }), invitationController.getById);
router.post(
  '/id/:id/accept',
  authenticate,
  validate({ params: paramsWithIdSchema }),
  invitationController.acceptById
);

// Viewing an invitation by token doesn't require login (the user may not
// have an account yet), but accepting/declining does — acceptance needs a
// concrete user to attach the membership to.
router.get(
  '/:token',
  validate({ params: invitationTokenParamsSchema }),
  invitationController.getByToken
);
router.post(
  '/:token/accept',
  authenticate,
  validate({ params: invitationTokenParamsSchema }),
  invitationController.accept
);
router.post(
  '/:token/decline',
  authenticate,
  validate({ params: invitationTokenParamsSchema }),
  invitationController.decline
);

export default router;
