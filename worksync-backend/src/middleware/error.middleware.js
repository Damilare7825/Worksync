import { Prisma } from '@prisma/client';
import multer from 'multer';
import { AppError } from '../utils/errors.js';
import { sendError } from '../utils/response.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * Catch-all for unmatched routes. Must be registered after all routes.
 */
export function notFoundHandler(req, _res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404, 'ROUTE_NOT_FOUND'));
}

/**
 * Centralized error handler. Must be registered last, after all routes
 * and other middleware.
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  // Safe structured logging
  logger.error(err.message || 'Unexpected server error', {
    requestId: req?.id,
    method: req?.method,
    route: req?.originalUrl,
    statusCode: err.statusCode || 500,
    userId: req?.user?.id,
    ...(env.isProduction ? {} : { stack: err.stack }),
  });

  if (err instanceof AppError) {
    return sendError(res, {
      statusCode: err.statusCode,
      message: err.message,
      code: err.code,
      details: err.details,
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return handlePrismaError(err, res);
  }

  if (err.type === 'entity.parse.failed') {
    return sendError(res, { statusCode: 400, message: 'Malformed JSON body', code: 'BAD_JSON' });
  }

  if (err instanceof multer.MulterError) {
    const isTooLarge = err.code === 'LIMIT_FILE_SIZE';
    return sendError(res, {
      statusCode: 400,
      message: isTooLarge ? 'File size exceeds the maximum allowed limit' : 'Invalid file upload',
      code: isTooLarge ? 'FILE_TOO_LARGE' : 'INVALID_UPLOAD',
    });
  }

  // Unknown/unexpected error — do not leak stack traces or internals.
  return sendError(res, {
    statusCode: 500,
    message: env.isProduction ? 'Internal server error' : err.message,
    code: 'INTERNAL_ERROR',
  });
}

function handlePrismaError(err, res) {
  switch (err.code) {
    case 'P2002':
      return sendError(res, {
        statusCode: 409,
        message: `A record with this ${err.meta?.target?.join(', ') || 'value'} already exists`,
        code: 'DUPLICATE_RECORD',
      });
    case 'P2025':
      return sendError(res, { statusCode: 404, message: 'Record not found', code: 'NOT_FOUND' });
    case 'P2003':
      return sendError(res, {
        statusCode: 400,
        message: 'Invalid reference to a related record',
        code: 'INVALID_REFERENCE',
      });
    default:
      return sendError(res, { statusCode: 500, message: 'Database error', code: 'DATABASE_ERROR' });
  }
}
