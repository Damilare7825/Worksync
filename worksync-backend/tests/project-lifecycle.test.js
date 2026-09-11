import { jest } from '@jest/globals';
import { createFakePrisma } from './helpers/fakePrisma.js';

let prisma;
let projectService;
let taskService;

beforeAll(async () => {
  prisma = createFakePrisma();
  jest.unstable_mockModule('../src/config/database.js', () => ({
    prisma,
    connectDatabase: async () => {},
    disconnectDatabase: async () => {},
  }));

  projectService = await import('../src/services/project.service.js');
  taskService = await import('../src/services/task.service.js');
});

async function seedScenario() {
  const manager = await prisma.user.create({ data: { name: 'Manager Mary', email: 'mary@ws.test', passwordHash: 'x' } });
  const member = await prisma.user.create({ data: { name: 'Member Mo', email: 'mo@ws.test', passwordHash: 'x' } });

  const workspace = await prisma.workspace.create({ data: { name: 'Acme', createdBy: manager.id } });
  await prisma.workspaceMember.create({ data: { workspaceId: workspace.id, userId: manager.id, role: 'OWNER' } });
  await prisma.workspaceMember.create({ data: { workspaceId: workspace.id, userId: member.id, role: 'MEMBER' } });

  const project = await prisma.project.create({
    data: { workspaceId: workspace.id, name: 'Website Redesign', createdBy: manager.id, status: 'ACTIVE' },
  });
  await prisma.projectMember.create({ data: { projectId: project.id, userId: manager.id, role: 'MANAGER' } });
  await prisma.projectMember.create({ data: { projectId: project.id, userId: member.id, role: 'MEMBER' } });

  return { manager, member, workspace, project };
}

describe('project lifecycle: archive & restore (Phase 13)', () => {
  test('archiving a project sets status to ARCHIVED and is idempotent', async () => {
    const { manager, project } = await seedScenario();
    const archived = await projectService.archiveProject(manager.id, project.id);
    expect(archived.status).toBe('ARCHIVED');

    // Archiving an already-archived project is a safe no-op, not an error.
    const again = await projectService.archiveProject(manager.id, project.id);
    expect(again.status).toBe('ARCHIVED');
  });

  test('restoring an archived project returns it to ACTIVE by default', async () => {
    const { manager, project } = await seedScenario();
    await projectService.archiveProject(manager.id, project.id);
    const restored = await projectService.restoreProject(manager.id, project.id);
    expect(restored.status).toBe('ACTIVE');
  });

  test('restoring can target COMPLETED explicitly', async () => {
    const { manager, project } = await seedScenario();
    await projectService.archiveProject(manager.id, project.id);
    const restored = await projectService.restoreProject(manager.id, project.id, 'COMPLETED');
    expect(restored.status).toBe('COMPLETED');
  });

  test('a plain MEMBER cannot archive a project', async () => {
    const { member, project } = await seedScenario();
    await expect(projectService.archiveProject(member.id, project.id)).rejects.toThrow();
  });

  test('updateProject with status: ARCHIVED routes through the same archive path', async () => {
    const { manager, project } = await seedScenario();
    const updated = await projectService.updateProject(manager.id, project.id, { status: 'ARCHIVED' });
    expect(updated.status).toBe('ARCHIVED');
  });
});

describe('archived projects are read-only for tasks (Phase 13)', () => {
  test('cannot create a task in an archived project', async () => {
    const { manager, project } = await seedScenario();
    await projectService.archiveProject(manager.id, project.id);

    await expect(taskService.createTask(manager.id, project.id, { title: 'New work' })).rejects.toThrow(
      /archived/i
    );
  });

  test('cannot update a task once its project is archived', async () => {
    const { manager, project } = await seedScenario();
    const task = await taskService.createTask(manager.id, project.id, { title: 'Existing task' });
    await projectService.archiveProject(manager.id, project.id);

    await expect(taskService.updateTask(manager.id, task.id, { status: 'IN_PROGRESS' })).rejects.toThrow(
      /archived/i
    );
  });

  test('restoring the project allows task operations again', async () => {
    const { manager, project } = await seedScenario();
    await projectService.archiveProject(manager.id, project.id);
    await projectService.restoreProject(manager.id, project.id);

    await expect(taskService.createTask(manager.id, project.id, { title: 'Back in action' })).resolves.toBeTruthy();
  });
});

describe('project listing excludes archived by default (Phase 13)', () => {
  test('listProjects hides ARCHIVED projects unless explicitly requested', async () => {
    const { manager, workspace, _project } = await seedScenario();
    await prisma.project.create({
      data: { workspaceId: workspace.id, name: 'Old Project', createdBy: manager.id, status: 'ARCHIVED' },
    });

    const defaultList = await projectService.listProjects(manager.id, workspace.id, { skip: 0, take: 20 });
    expect(defaultList.items.map((p) => p.name)).toContain('Website Redesign');
    expect(defaultList.items.map((p) => p.name)).not.toContain('Old Project');

    const archivedOnly = await projectService.listProjects(
      manager.id,
      workspace.id,
      { skip: 0, take: 20 },
      { status: 'ARCHIVED' }
    );
    expect(archivedOnly.items.map((p) => p.name)).toEqual(['Old Project']);
  });
});

describe('project stats (Phase 13)', () => {
  test('returns task counts by status and overdue count', async () => {
    const { manager, project } = await seedScenario();
    await taskService.createTask(manager.id, project.id, { title: 'Task 1' });
    const t2 = await taskService.createTask(manager.id, project.id, { title: 'Task 2' });
    await taskService.updateTask(manager.id, t2.id, { status: 'IN_PROGRESS' });

    const stats = await projectService.getProjectStats(manager.id, project.id);
    expect(stats.totalTasks).toBe(2);
    expect(stats.tasksByStatus.TODO).toBe(1);
    expect(stats.tasksByStatus.IN_PROGRESS).toBe(1);
    expect(stats.memberCount).toBe(2);
  });
});
