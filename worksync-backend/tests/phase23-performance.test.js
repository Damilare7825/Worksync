import { jest } from '@jest/globals';
import { createFakePrisma } from './helpers/fakePrisma.js';
import { MemoryCache, appCache } from '../src/utils/cache.js';
import { getPaginationParams, buildPaginationMeta } from '../src/utils/pagination.js';

let prisma;
let authorizationService;
let dashboardService;
let taskService;

beforeAll(async () => {
  prisma = createFakePrisma();
  jest.unstable_mockModule('../src/config/database.js', () => ({
    prisma,
    connectDatabase: async () => {},
    disconnectDatabase: async () => {},
  }));

  authorizationService = await import('../src/services/authorization.service.js');
  dashboardService = await import('../src/services/dashboard.service.js');
  taskService = await import('../src/services/task.service.js');
});

beforeEach(() => {
  prisma._resetAll();
  appCache.clear();
});

describe('Phase 23 — Performance & Database Optimization Suite', () => {
  describe('In-Memory TTL Caching Engine', () => {
    test('cache set and get works with value preservation', () => {
      const cache = new MemoryCache();
      cache.set('test:key', { foo: 'bar' }, 60);

      expect(cache.has('test:key')).toBe(true);
      expect(cache.get('test:key')).toEqual({ foo: 'bar' });
      expect(cache.get('test:nonexistent')).toBeNull();
    });

    test('cache entries expire after their TTL', async () => {
      const cache = new MemoryCache();
      // Set with 0.05 second (50ms) TTL
      cache.set('temp:key', 'quick-expire', 0.05);

      expect(cache.get('temp:key')).toBe('quick-expire');

      await new Promise((resolve) => setTimeout(resolve, 70));

      expect(cache.get('temp:key')).toBeNull();
    });

    test('delByPrefix removes all keys matching prefix', () => {
      const cache = new MemoryCache();
      cache.set('auth:ws:1:user1', 'member', 60);
      cache.set('auth:ws:1:user2', 'admin', 60);
      cache.set('auth:ws:2:user1', 'owner', 60);
      cache.set('user:pref:user1', 'dark', 60);

      const deleted = cache.delByPrefix('auth:ws:1:');
      expect(deleted).toBe(2);
      expect(cache.get('auth:ws:1:user1')).toBeNull();
      expect(cache.get('auth:ws:1:user2')).toBeNull();
      expect(cache.get('auth:ws:2:user1')).toBe('owner');
      expect(cache.get('user:pref:user1')).toBe('dark');
    });

    test('wrap implements cache-aside pattern without redundant executions', async () => {
      const cache = new MemoryCache();
      let fetchCount = 0;
      const expensiveFetch = async () => {
        fetchCount++;
        return { data: 'expensive-result' };
      };

      // First call: cache miss, executes function
      const first = await cache.wrap('query:1', 60, expensiveFetch);
      expect(first).toEqual({ data: 'expensive-result' });
      expect(fetchCount).toBe(1);

      // Second call: cache hit, uses cached value
      const second = await cache.wrap('query:1', 60, expensiveFetch);
      expect(second).toEqual({ data: 'expensive-result' });
      expect(fetchCount).toBe(1);

      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
    });
  });

  describe('Authorization Caching & Invalidation', () => {
    test('getWorkspaceMembership caches result and invalidates properly', async () => {
      const user = await prisma.user.create({ data: { name: 'Member', email: 'mem@test.com', passwordHash: 'x' } });
      const ws = await prisma.workspace.create({ data: { name: 'WS', createdBy: user.id } });
      await prisma.workspaceMember.create({ data: { workspaceId: ws.id, userId: user.id, role: 'MEMBER' } });

      // First lookup
      const mem1 = await authorizationService.getWorkspaceMembership(user.id, ws.id);
      expect(mem1).toBeDefined();
      expect(mem1.role).toBe('MEMBER');

      // Verify cached in appCache
      const cacheKey = `auth:ws:${ws.id}:${user.id}`;
      expect(appCache.get(cacheKey)).toBeDefined();

      // Mutate member in DB
      await prisma.workspaceMember.update({
        where: { workspaceId_userId: { workspaceId: ws.id, userId: user.id } },
        data: { role: 'ADMIN' },
      });

      // Still cached as MEMBER before invalidation
      const memCached = await authorizationService.getWorkspaceMembership(user.id, ws.id);
      expect(memCached.role).toBe('MEMBER');

      // Invalidate cache
      authorizationService.invalidateWorkspaceAuth(ws.id, user.id);
      expect(appCache.get(cacheKey)).toBeNull();

      // Next lookup gets fresh ADMIN role
      const memFresh = await authorizationService.getWorkspaceMembership(user.id, ws.id);
      expect(memFresh.role).toBe('ADMIN');
    });

    test('getProjectContext caches result and invalidates on project changes', async () => {
      const user = await prisma.user.create({ data: { name: 'Owner', email: 'owner@test.com', passwordHash: 'x' } });
      const ws = await prisma.workspace.create({ data: { name: 'WS', createdBy: user.id } });
      await prisma.workspaceMember.create({ data: { workspaceId: ws.id, userId: user.id, role: 'OWNER' } });
      const proj = await prisma.project.create({ data: { name: 'P1', workspaceId: ws.id, createdBy: user.id } });

      const ctx1 = await authorizationService.getProjectContext(user.id, proj.id);
      expect(ctx1.project.id).toBe(proj.id);

      const projCacheKey = `auth:proj:${proj.id}:${user.id}`;
      expect(appCache.get(projCacheKey)).toBeDefined();

      // Invalidate project auth
      authorizationService.invalidateProjectAuth(proj.id, user.id);
      expect(appCache.get(projCacheKey)).toBeNull();
    });
  });

  describe('Dashboard Query Optimization & Caching', () => {
    test('getDashboardStats aggregates counts correctly and caches results', async () => {
      const user = await prisma.user.create({ data: { name: 'User Dash', email: 'dash@test.com', passwordHash: 'x' } });
      const ws = await prisma.workspace.create({ data: { name: 'WS Dash', createdBy: user.id } });
      await prisma.workspaceMember.create({ data: { workspaceId: ws.id, userId: user.id, role: 'OWNER' } });
      const proj = await prisma.project.create({ data: { name: 'Active Proj', workspaceId: ws.id, createdBy: user.id, status: 'ACTIVE' } });

      // Create tasks with different statuses and priorities
      await prisma.task.create({
        data: { title: 'Task 1', projectId: proj.id, creatorId: user.id, assigneeId: user.id, status: 'TODO', priority: 'HIGH' },
      });
      await prisma.task.create({
        data: { title: 'Task 2', projectId: proj.id, creatorId: user.id, assigneeId: user.id, status: 'IN_PROGRESS', priority: 'MEDIUM' },
      });
      await prisma.task.create({
        data: { title: 'Task 3', projectId: proj.id, creatorId: user.id, assigneeId: user.id, status: 'COMPLETED', priority: 'LOW' },
      });

      const stats = await dashboardService.getDashboardStats(user.id);
      expect(stats.totalTasks).toBe(3);
      expect(stats.todo).toBe(1);
      expect(stats.inProgress).toBe(1);
      expect(stats.completed).toBe(1);
      expect(stats.tasksByPriority.HIGH).toBe(1);
      expect(stats.tasksByPriority.MEDIUM).toBe(1);
      expect(stats.tasksByPriority.LOW).toBe(1);

      // Verify cached
      const cacheKey = `dashboard:stats:${user.id}`;
      expect(appCache.get(cacheKey)).toBeDefined();

      // Invalidate
      dashboardService.invalidateDashboardCache(user.id);
      expect(appCache.get(cacheKey)).toBeNull();
    });
  });

  describe('Lightweight Task Listing', () => {
    test('listTasks supports lightweight mode for optimized list views', async () => {
      const user = await prisma.user.create({ data: { name: 'Owner', email: 'owner2@test.com', passwordHash: 'x' } });
      const ws = await prisma.workspace.create({ data: { name: 'WS', createdBy: user.id } });
      await prisma.workspaceMember.create({ data: { workspaceId: ws.id, userId: user.id, role: 'OWNER' } });
      const proj = await prisma.project.create({ data: { name: 'P', workspaceId: ws.id, createdBy: user.id } });

      await prisma.task.create({
        data: { title: 'Lightweight Test', projectId: proj.id, creatorId: user.id },
      });

      // Standard list
      const fullList = await taskService.listTasks(user.id, proj.id, {}, { skip: 0, take: 20 }, { lightweight: false });
      expect(fullList.items).toHaveLength(1);
      expect(fullList.total).toBe(1);

      // Lightweight list
      const lightList = await taskService.listTasks(user.id, proj.id, {}, { skip: 0, take: 20 }, { lightweight: true });
      expect(lightList.items).toHaveLength(1);
      expect(lightList.total).toBe(1);
      expect(lightList.items[0].title).toBe('Lightweight Test');
    });
  });

  describe('Pagination Bounds & Normalization', () => {
    test('getPaginationParams clamps negative pages and oversized limits', () => {
      const clamped = getPaginationParams({ page: -10, limit: 9999 });
      expect(clamped.page).toBe(1);
      expect(clamped.limit).toBe(100);
      expect(clamped.skip).toBe(0);
      expect(clamped.take).toBe(100);
    });

    test('getPaginationParams uses standard defaults when omitted', () => {
      const standard = getPaginationParams({});
      expect(standard.page).toBe(1);
      expect(standard.limit).toBe(20);
      expect(standard.skip).toBe(0);
      expect(standard.take).toBe(20);
    });

    test('buildPaginationMeta calculates totalPages accurately', () => {
      const meta = buildPaginationMeta({ page: 1, limit: 20, total: 45 });
      expect(meta.totalPages).toBe(3);
      expect(meta.total).toBe(45);
      expect(meta.page).toBe(1);
    });
  });
});
