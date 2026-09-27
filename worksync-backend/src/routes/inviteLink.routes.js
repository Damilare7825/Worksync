import { Router } from 'express';
import * as inviteLinkController from '../controllers/inviteLink.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { z } from 'zod';
import { validate } from '../middleware/validation.middleware.js';
import { inviteLinkLimiter } from '../middleware/rateLimit.middleware.js';

const router = Router();

const tokenParamsSchema = z.object({ token: z.string().min(10).max(200) });

router.get('/:token', inviteLinkLimiter, validate({ params: tokenParamsSchema }), inviteLinkController.preview);
router.post('/:token/join', inviteLinkLimiter, authenticate, validate({ params: tokenParamsSchema }), inviteLinkController.join);

export default router;
