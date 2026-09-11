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

async function seedFixture() {
  const manager = await prisma.user.create({
    data: { name: 'Project Manager', email: `pm-${Date.now()}@ws.test`, passwordHash: 'hash' },
  });
  const member = await prisma.user.create({
    data: { name: 'Team Member', email: `member-${Date.now()}@ws.test`, passwordHash: 'hash' },
  });
  const outsider = await prisma.user.create({
    data: { name: 'Outsider', email: `outsider-${Date.now()}@ws.test`, passwordHash: 'hash' },
  });

  const workspace = await prisma.workspace.create({
    data: { name: 'Productivity Workspace', createdBy: manager.id },
  });

  await prisma.workspaceMember.create({
    data: { workspaceId: workspace.id, userId: manager.id, role: 'ADMIN' },
  });
  await prisma.workspaceMember.create({
    data: { workspaceId: workspace.id, userId: member.id, role: 'MEMBER' },
  });

  const project = await prisma.project.create({
    data: { workspaceId: workspace.id, name: 'Productivity Project', createdBy: manager.id },
  });

  await prisma.projectMember.create({
    data: { projectId: project.id, userId: manager.id, role: 'MANAGER' },
  });
  await prisma.projectMember.create({
    data: { projectId: project.id, userId: member.id, role: 'MEMBER' },
  });

  const task1 = await prisma.task.create({
    data: {
      projectId: project.id,
      creatorId: manager.id,
      assigneeId: member.id,
      title: 'Task 1',
      status: 'TODO',
      position: 0,
    },
  });

  const task2 = await prisma.task.create({
    data: {
      projectId: project.id,
      creatorId: manager.id,
      assigneeId: member.id,
      title: 'Task 2',
      status: 'TODO',
      position: 1,
    },
  });

  const task3 = await prisma.task.create({
    data: {
      projectId: project.id,
      creatorId: manager.id,
      assigneeId: member.id,
      title: 'Task 3',
      status: 'IN_PROGRESS',
      position: 0,
    },
  });

  return { manager, member, outsider, workspace, project, task1, task2, task3 };
}

describe('Phase 19 — Advanced Productivity Views & Operations', () => {
  test('moveTask reorders task position and changes status correctly', async () => {
    const { manager, task1, task3 } = await seedFixture();

    // Move task1 from TODO to IN_PROGRESS before task3
    const moved = await taskService.moveTask(manager.id, task1.id, {
      status: 'IN_PROGRESS',
      beforeTaskId: task3.id,
    });

    expect(moved.status).toBe('IN_PROGRESS');

    const updatedTask1 = await prisma.task.findUnique({ where: { id: task1.id } });
    expect(updatedTask1.status).toBe('IN_PROGRESS');
  });

  test('bulkUpdateTasks updates status and priority for multiple tasks', async () => {
    const { manager, task1, task2 } = await seedFixture();

    const res = await taskService.bulkUpdateTasks(manager.id, {
      taskIds: [task1.id, task2.id],
      status: 'COMPLETED',
      priority: 'HIGH',
    });

    expect(res.updatedCount).toBe(2);

    const t1 = await prisma.task.findUnique({ where: { id: task1.id } });
    const t2 = await prisma.task.findUnique({ where: { id: task2.id } });

    expect(t1.status).toBe('COMPLETED');
    expect(t1.priority).toBe('HIGH');
    expect(t2.status).toBe('COMPLETED');
    expect(t2.priority).toBe('HIGH');
  });

  test('bulkUpdateTasks fails if user does not have permission', async () => {
    const { outsider, task1 } = await seedFixture();

    await expect(
      taskService.bulkUpdateTasks(outsider.id, {
        taskIds: [task1.id],
        priority: 'URGENT',
      })
    ).rejects.toThrow();
  });
});
