import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { validate } from '../middleware/validation.middleware.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { authLimiter } from '../middleware/rateLimit.middleware.js';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from '../validators/auth.validator.js';

const router = Router();

router.post('/register', authLimiter, validate({ body: registerSchema }), authController.register);
router.post('/login', authLimiter, validate({ body: loginSchema }), authController.login);
router.get('/me', authenticate, authController.me);
// Refresh is deliberately unauthenticated: its HttpOnly cookie is the
// credential. It is rate-limited and performs explicit Origin validation in
// the controller to provide CSRF protection for cookie-based refreshes.
router.post('/refresh', authLimiter, authController.refresh);
router.post('/logout', authenticate, authController.logout);

// authLimiter is reused here too: forgot-password is a common brute-force /
// enumeration / email-bombing target, same as login.
router.post(
  '/forgot-password',
  authLimiter,
  validate({ body: forgotPasswordSchema }),
  authController.forgotPassword
);
router.post(
  '/reset-password',
  authLimiter,
  validate({ body: resetPasswordSchema }),
  authController.resetPassword
);
router.post(
  '/change-password',
  authenticate,
  validate({ body: changePasswordSchema }),
  authController.changePassword
);

export default router;
