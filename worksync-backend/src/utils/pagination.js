/**
 * Normalizes page/limit query params and produces Prisma skip/take values
 * plus a standard pagination metadata object for responses.
 */

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export function getPaginationParams({ page, limit } = {}) {
  const parsedPage = Math.max(parseInt(page, 10) || DEFAULT_PAGE, 1);
  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);

  return {
    page: parsedPage,
    limit: parsedLimit,
    skip: (parsedPage - 1) * parsedLimit,
    take: parsedLimit,
  };
}

export function buildPaginationMeta({ page, limit, total }) {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(Math.ceil(total / limit), 1),
  };
}
