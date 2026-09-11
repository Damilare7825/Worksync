import { jest } from '@jest/globals';
import { createFakePrisma } from './helpers/fakePrisma.js';

let prisma;
let taskService;

beforeAll(async () => {
  prisma = createFakePrisma();
  jest.unstable_mockModule('../src/config/database.js', () => ({
    prisma,
    connectDatabase: async () => {},
    disconnectDatabase: async () => {},
  }));

  taskService = await import('../src/services/task.service.js');
});

const WORKSPACE_ID = 'ws-pagination';
const PROJECT_ID = 'proj-pagination';
const SECOND_PROJECT_ID = 'proj-pagination-second';

async function seed() {
  await prisma.workspace.create({ data: { id: WORKSPACE_ID, name: 'Pagination WS', createdBy: 'u1' } });
  await prisma.workspaceMember.create({ data: { workspaceId: WORKSPACE_ID, userId: 'u1', role: 'OWNER' } });
  await prisma.project.create({ data: { id: PROJECT_ID, workspaceId: WORKSPACE_ID, name: 'Pagination Project', createdBy: 'u1' } });
  await prisma.projectMember.create({ data: { projectId: PROJECT_ID, userId: 'u1', role: 'MANAGER' } });
  await prisma.project.create({ data: { id: SECOND_PROJECT_ID, workspaceId: WORKSPACE_ID, name: 'Second Pagination Project', createdBy: 'u1' } });
  await prisma.projectMember.create({ data: { projectId: SECOND_PROJECT_ID, userId: 'u1', role: 'MANAGER' } });

  for (let i = 1; i <= 25; i++) {
    await prisma.task.create({
      data: {
        projectId: PROJECT_ID,
        creatorId: 'u1',
        title: `Task ${i}`,
        status: i <= 5 ? 'TODO' : i <= 15 ? 'IN_PROGRESS' : 'COMPLETED',
        priority: i % 3 === 0 ? 'HIGH' : 'MEDIUM',
        assigneeId: i % 2 === 0 ? 'u1' : null,
        dueDate: new Date(`2026-01-${String((i % 9) + 1).padStart(2, '0')}T00:00:00.000Z`),
      },
    });
  }
  await prisma.task.create({
    data: { projectId: SECOND_PROJECT_ID, creatorId: 'u1', title: 'Second project task', status: 'TODO', priority: 'HIGH', assigneeId: 'u1', dueDate: new Date('2026-02-01T00:00:00.000Z') },
  });
}

beforeEach(async () => {
  prisma._resetAll();
  await seed();
});

describe('Workspace Task Pagination', () => {
  test('first page returns default limit', async () => {
    const { items, total } = await taskService.listWorkspaceTasks('u1', WORKSPACE_ID, {}, { skip: 0, take: 20 });
    expect(items).toHaveLength(20);
    expect(total).toBe(26);
  });

  test('second page returns remaining items', async () => {
    const { items, total } = await taskService.listWorkspaceTasks('u1', WORKSPACE_ID, {}, { skip: 20, take: 20 });
    expect(items).toHaveLength(6);
    expect(total).toBe(26);
  });

  test('empty page returns empty items', async () => {
    const { items, total } = await taskService.listWorkspaceTasks('u1', WORKSPACE_ID, {}, { skip: 100, take: 20 });
    expect(items).toHaveLength(0);
    expect(total).toBe(26);
  });

  test('status filter works', async () => {
    const { items, total } = await taskService.listWorkspaceTasks('u1', WORKSPACE_ID, { status: 'TODO' }, { skip: 0, take: 100 });
    expect(total).toBe(6);
    expect(items.every((t) => t.status === 'TODO')).toBe(true);
  });

  test('priority filter works', async () => {
    const { items, total } = await taskService.listWorkspaceTasks('u1', WORKSPACE_ID, { priority: 'HIGH' }, { skip: 0, take: 100 });
    expect(total).toBeGreaterThan(0);
    expect(items.every((t) => t.priority === 'HIGH')).toBe(true);
  });

  test('assignee filter works', async () => {
    const { items, total } = await taskService.listWorkspaceTasks('u1', WORKSPACE_ID, { assigneeId: 'u1' }, { skip: 0, take: 100 });
    expect(total).toBeGreaterThan(0);
    expect(items.every((t) => t.assigneeId === 'u1')).toBe(true);
  });

  test('project, status, and due-date filters are combined in the database query', async () => {
    const { items, total } = await taskService.listWorkspaceTasks(
      'u1',
      WORKSPACE_ID,
      { projectId: PROJECT_ID, status: 'TODO', dueFrom: new Date('2026-01-01T00:00:00.000Z'), dueTo: new Date('2026-01-09T23:59:59.999Z') },
      { skip: 0, take: 100 }
    );
    expect(total).toBe(5);
    expect(items).toHaveLength(5);
    expect(items.every((task) => task.projectId === PROJECT_ID && task.status === 'TODO')).toBe(true);
  });

  test('project filter excludes tasks from other workspace projects', async () => {
    const { items, total } = await taskService.listWorkspaceTasks(
      'u1', WORKSPACE_ID, { projectId: SECOND_PROJECT_ID }, { skip: 0, take: 20 }
    );
    expect(total).toBe(1);
    expect(items[0].title).toBe('Second project task');
  });

  test('non-member gets not found', async () => {
    await expect(
      taskService.listWorkspaceTasks('u2', WORKSPACE_ID, {}, { skip: 0, take: 100 })
    ).rejects.toThrow('Workspace not found');
  });
});
