import { getPaginationParams, buildPaginationMeta } from '../src/utils/pagination.js';

describe('pagination util', () => {
  test('applies defaults when nothing provided', () => {
    const result = getPaginationParams({});
    expect(result).toEqual({ page: 1, limit: 20, skip: 0, take: 20 });
  });

  test('computes skip correctly for page > 1', () => {
    const result = getPaginationParams({ page: 3, limit: 10 });
    expect(result).toEqual({ page: 3, limit: 10, skip: 20, take: 10 });
  });

  test('clamps limit to MAX_LIMIT', () => {
    const result = getPaginationParams({ page: 1, limit: 1000 });
    expect(result.limit).toBe(100);
  });

  test('rejects non-positive page/limit by falling back to defaults', () => {
    const result = getPaginationParams({ page: -5, limit: 0 });
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  test('buildPaginationMeta computes totalPages', () => {
    const meta = buildPaginationMeta({ page: 1, limit: 20, total: 45 });
    expect(meta.totalPages).toBe(3);
  });
});
