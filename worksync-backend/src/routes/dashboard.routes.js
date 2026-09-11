import { Router } from 'express';
import * as dashboardController from '../controllers/dashboard.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validation.middleware.js';
import { analyticsQuerySchema } from '../validators/dashboard.validator.js';
import { paramsWithIdSchema } from '../validators/common.validator.js';
import { z } from 'zod';

const router = Router();

router.use(authenticate);
router.get('/stats', dashboardController.getStats);
router.get('/workspaces/:workspaceId', validate({ params: z.object({ workspaceId: paramsWithIdSchema.shape.id }), query: analyticsQuerySchema }), dashboardController.getWorkspaceAnalytics);
router.get('/workspaces/:workspaceId/personal', validate({ params: z.object({ workspaceId: paramsWithIdSchema.shape.id }), query: analyticsQuerySchema }), dashboardController.getPersonalAnalytics);
router.get('/projects/:projectId', validate({ params: z.object({ projectId: paramsWithIdSchema.shape.id }), query: analyticsQuerySchema }), dashboardController.getProjectAnalytics);

export default router;
