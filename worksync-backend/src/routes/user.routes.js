import { Router } from 'express';
import * as userController from '../controllers/user.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validation.middleware.js';
import { updateProfileSchema } from '../validators/user.validator.js';
import { paramsWithIdSchema } from '../validators/common.validator.js';
import multer from 'multer';
import { env } from '../config/env.js';

const router = Router();

router.use(authenticate);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxFileSize },
});

router.get('/me', userController.getMe);
router.put('/me', validate({ body: updateProfileSchema }), userController.updateMe);
router.delete('/me', userController.deleteMe);
router.get('/:id', validate({ params: paramsWithIdSchema }), userController.getUserPublicProfile);
router.post('/me/avatar', upload.single('avatar'), userController.uploadAvatar);
router.delete('/me/avatar', userController.deleteAvatar);

export default router;
