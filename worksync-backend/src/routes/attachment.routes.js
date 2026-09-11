import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth.middleware.js';
import { env } from '../config/env.js';
import {
  uploadAttachmentHandler,
  getAttachmentHandler,
  downloadAttachmentHandler,
  listAttachmentsHandler,
  deleteAttachmentHandler,
} from '../controllers/attachment.controller.js';
import { validate } from '../middleware/validation.middleware.js';
import { attachmentScopeSchema } from '../validators/attachment.validator.js';
import { paginationSchema, paramsWithIdSchema } from '../validators/common.validator.js';
import { z } from 'zod';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxFileSize },
});

export const attachmentRouter = Router();

attachmentRouter.use(authenticate);

attachmentRouter.post('/upload', upload.single('file'), uploadAttachmentHandler);
attachmentRouter.get('/', validate({ query: z.intersection(attachmentScopeSchema, paginationSchema) }), listAttachmentsHandler);
attachmentRouter.get('/:id', validate({ params: paramsWithIdSchema }), getAttachmentHandler);
attachmentRouter.get('/:id/download', validate({ params: paramsWithIdSchema }), downloadAttachmentHandler);
attachmentRouter.delete('/:id', validate({ params: paramsWithIdSchema }), deleteAttachmentHandler);
