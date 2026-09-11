import { Router } from 'express';
import * as notificationController from '../controllers/notification.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validation.middleware.js';
import { paginationSchema, paramsWithIdSchema } from '../validators/common.validator.js';

const router = Router();
router.use(authenticate);

router.get('/', validate({ query: paginationSchema }), notificationController.list);
router.patch('/:id/read', validate({ params: paramsWithIdSchema }), notificationController.markRead);
router.patch('/read-all', notificationController.markAllRead);

export default router;
