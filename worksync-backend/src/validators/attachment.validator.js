import { z } from 'zod';
import { ValidationError } from '../utils/errors.js';
import path from 'path';

const FORBIDDEN_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.sh', '.vbs', '.ps1', '.msi', '.dll', '.com', '.scr', '.pif', '.application', '.gadget', '.hta', '.cpl', '.msc', '.jar',
];

const MAGIC_MIME_TYPES = [
  { signature: Buffer.from('%PDF-'), mimeType: 'application/pdf' },
  { signature: Buffer.from([0x89, 0x50, 0x4e, 0x47]), mimeType: 'image/png' },
  { signature: Buffer.from([0xff, 0xd8, 0xff]), mimeType: 'image/jpeg' },
  { signature: Buffer.from('GIF87a'), mimeType: 'image/gif' },
  { signature: Buffer.from('GIF89a'), mimeType: 'image/gif' },
];

export function validateUploadedFile(file, maxSizeBytes = 10 * 1024 * 1024) {
  if (!file) {
    throw new ValidationError('No file was uploaded');
  }

  if (!file.originalname || file.originalname.length > 255 || file.originalname.includes('\0')) {
    throw new ValidationError('File name is invalid');
  }

  if (path.basename(file.originalname) !== file.originalname) {
    throw new ValidationError('File name must not contain a path');
  }

  if (file.size > maxSizeBytes) {
    throw new ValidationError(`File size exceeds maximum allowed limit of ${Math.round(maxSizeBytes / (1024 * 1024))}MB`);
  }

  const ext = path.extname(file.originalname).toLowerCase();
  if (FORBIDDEN_EXTENSIONS.includes(ext)) {
    throw new ValidationError(`File type '${ext}' is not allowed for security reasons.`);
  }
}

/**
 * Derives a response MIME type from file bytes. Client multipart metadata is
 * advisory only, so unknown binary formats deliberately download as octets.
 */
export function deriveSafeMimeType(fileBuffer) {
  if (!Buffer.isBuffer(fileBuffer)) return 'application/octet-stream';

  const detected = MAGIC_MIME_TYPES.find(({ signature }) => fileBuffer.subarray(0, signature.length).equals(signature));
  if (detected) return detected.mimeType;

  // Treat only small, NUL-free UTF-8 payloads as text. This keeps HTML/SVG
  // downloads inert because they are served as text/plain rather than inline
  // under a browser-interpretable type.
  if (fileBuffer.length <= 1024 * 1024 && !fileBuffer.includes(0)) {
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(fileBuffer);
      return 'text/plain; charset=utf-8';
    } catch {
      // Fall through to the safe binary default.
    }
  }

  return 'application/octet-stream';
}

/**
 * Validates that a file is an allowed image type for avatar uploads.
 * Uses magic byte detection to prevent relying on client-provided MIME type.
 */
export function validateAvatarFile(file) {
  // Reuse the general file validation for basic checks
  validateUploadedFile(file, 10 * 1024 * 1024); // 10MB limit, same as general attachments

  // Check that it's an image using magic byte detection
  if (!Buffer.isBuffer(file.buffer)) {
    throw new ValidationError('Invalid file data');
  }

  const detected = MAGIC_MIME_TYPES.find(({ signature }) =>
    file.buffer.subarray(0, signature.length).equals(signature)
  );

  // Check if it's one of our allowed image types
  const allowedImageTypes = [
    'image/png',
    'image/jpeg',
    'image/gif'
  ];

  if (!detected || !allowedImageTypes.includes(detected.mimeType)) {
    throw new ValidationError('Avatar must be a valid PNG, JPEG, or GIF image');
  }
}

export const attachmentScopeFieldsSchema = z.object({
  workspaceId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  taskId: z.string().uuid().optional(),
  commentId: z.string().uuid().optional(),
}).strict();

export const attachmentScopeSchema = attachmentScopeFieldsSchema.superRefine((scope, ctx) => {
  const scopedIds = Object.values(scope).filter(Boolean);
  if (scopedIds.length !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide exactly one attachment scope: workspaceId, projectId, taskId, or commentId.',
    });
  }
});

export function validateAttachmentScope(scope, { requireSingleScope = false } = {}) {
  const parsed = (requireSingleScope ? attachmentScopeSchema : attachmentScopeFieldsSchema).safeParse(scope);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0].message);
  }
  return parsed.data;
}
