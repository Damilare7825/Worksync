import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import {
  uploadAttachment,
  getAttachmentWithAccess,
  streamAttachment,
  listAttachments,
  deleteAttachment,
} from '../services/attachment.service.js';
import { validateAttachmentScope, validateUploadedFile } from '../validators/attachment.validator.js';
import { env } from '../config/env.js';
import { getPaginationParams, buildPaginationMeta } from '../utils/pagination.js';

export const uploadAttachmentHandler = asyncHandler(async (req, res) => {
  validateUploadedFile(req.file, env.maxFileSize);

  const { workspaceId, projectId, taskId, commentId } = req.body;
  validateAttachmentScope({ workspaceId, projectId, taskId, commentId }, { requireSingleScope: true });
  const attachment = await uploadAttachment(req.user.id, {
    workspaceId,
    projectId,
    taskId,
    commentId,
    file: req.file,
  });

  return sendSuccess(res, { statusCode: 201, message: 'Attachment uploaded', data: { attachment } });
});

export const getAttachmentHandler = asyncHandler(async (req, res) => {
  const attachment = await getAttachmentWithAccess(req.user.id, req.params.id);
  return sendSuccess(res, { message: 'Attachment retrieved', data: { attachment } });
});

export const downloadAttachmentHandler = asyncHandler(async (req, res) => {
  const { attachment, stream } = await streamAttachment(req.user.id, req.params.id);
  const inline = req.query.inline === 'true';
  const disposition = inline ? 'inline' : 'attachment';

  res.setHeader('Content-Type', attachment.mimeType);
  res.setHeader(
    'Content-Disposition',
    `${disposition}; filename="${encodeURIComponent(attachment.originalName)}"`
  );
  res.setHeader('Content-Length', attachment.sizeBytes);

  stream.pipe(res);
});

export const listAttachmentsHandler = asyncHandler(async (req, res) => {
  const { workspaceId, projectId, taskId, commentId } = req.query;
  validateAttachmentScope({ workspaceId, projectId, taskId, commentId }, { requireSingleScope: true });
  const { page, limit, skip, take } = getPaginationParams(req.query);
  const { items, total } = await listAttachments(
    req.user.id,
    { workspaceId, projectId, taskId, commentId },
    { skip, take }
  );

  return sendSuccess(res, {
    message: 'Attachments retrieved',
    data: { attachments: items },
    meta: buildPaginationMeta({ page, limit, total }),
  });
});

export const deleteAttachmentHandler = asyncHandler(async (req, res) => {
  await deleteAttachment(req.user.id, req.params.id);
  return sendSuccess(res, { message: 'Attachment deleted successfully' });
});
