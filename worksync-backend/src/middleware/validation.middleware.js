import { ZodError } from 'zod';
import { ValidationError } from '../utils/errors.js';

/**
 * Validates req.body / req.query / req.params against Zod schemas and
 * replaces them with the parsed (coerced, defaulted) values.
 *
 * Usage: validate({ body: createTaskSchema, query: taskFilterSchema })
 */
export function validate(schemas) {
  return (req, _res, next) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.query) req.query = schemas.query.parse(req.query);
      if (schemas.params) req.params = schemas.params.parse(req.params);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const details = err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        next(new ValidationError('Validation failed', details));
      } else {
        next(err);
      }
    }
  };
}
