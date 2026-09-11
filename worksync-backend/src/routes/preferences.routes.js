import { Router } from 'express';
import * as preferencesController from '../controllers/preferences.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validation.middleware.js';
import { userPreferencesSchema, notificationPreferencesSchema } from '../validators/userPreference.validator.js';

const router = Router();

// User preferences
router.get('/preferences', authenticate, preferencesController.getPreferences);
router.patch('/preferences', authenticate, validate({ body: userPreferencesSchema }), preferencesController.updatePreferences);

// Notification preferences
router.get('/notification-preferences', authenticate, preferencesController.getNotificationPreferences);
router.patch('/notification-preferences', authenticate, validate({ body: notificationPreferencesSchema }), preferencesController.updateNotificationPreferences);

export default router;