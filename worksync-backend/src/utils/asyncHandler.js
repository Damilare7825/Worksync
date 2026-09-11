/**
 * Wraps an async Express handler so rejected promises are forwarded to
 * next(err) instead of requiring try/catch in every controller.
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
