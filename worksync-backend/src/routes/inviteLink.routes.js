import { Router } from 'express';
import * as inviteLinkController from '../controllers/inviteLink.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { z } from 'zod';
import { validate } from '../middleware/validation.middleware.js';

const router = Router();

const tokenParamsSchema = z.object({ token: z.string().min(10).max(200) });

router.get('/:token', validate({ params: tokenParamsSchema }), inviteLinkController.preview);
router.post('/:token/join', authenticate, validate({ params: tokenParamsSchema }), inviteLinkController.join);

export default router;
