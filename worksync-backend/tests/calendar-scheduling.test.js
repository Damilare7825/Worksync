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
    data: { name: 'Manager User', email: `mgr-${Date.now()}@ws.test`, passwordHash: 'hash' },
  });
  const member = await prisma.user.create({
    data: { name: 'Member User', email: `mem-${Date.now()}@ws.test`, passwordHash: 'hash' },
  });
  const outsider = await prisma.user.create({
    data: { name: 'Outsider User', email: `out-${Date.now()}@ws.test`, passwordHash: 'hash' },
  });

  const workspace = await prisma.workspace.create({
    data: { name: 'Calendar Workspace', createdBy: manager.id },
  });

  await prisma.workspaceMember.create({
    data: { workspaceId: workspace.id, userId: manager.id, role: 'ADMIN' },
  });
  await prisma.workspaceMember.create({
    data: { workspaceId: workspace.id, userId: member.id, role: 'MEMBER' },
  });

  const project = await prisma.project.create({
    data: { workspaceId: workspace.id, name: 'Calendar Project', createdBy: manager.id },
  });

  await prisma.projectMember.create({
    data: { projectId: project.id, userId: manager.id, role: 'MANAGER' },
  });
  await prisma.projectMember.create({
    data: { projectId: project.id, userId: member.id, role: 'MEMBER' },
  });

  const todayStr = new Date().toISOString().slice(0, 10);
  const taskToday = await prisma.task.create({
    data: {
      projectId: project.id,
      creatorId: manager.id,
      assigneeId: member.id,
      title: 'Due Today',
      dueDate: new Date(`${todayStr}T12:00:00.000Z`),
      status: 'TODO',
    },
  });

  return { manager, member, outsider, workspace, project, taskToday };
}

describe('Phase 20 — Advanced Calendar & Scheduling Backend Logic', () => {
  test('reschedules task due date via task update API', async () => {
    const { manager, taskToday } = await seedFixture();
    const newDueDate = new Date('2026-10-15T00:00:00.000Z');

    const updated = await taskService.updateTask(manager.id, taskToday.id, {
      dueDate: newDueDate,
    });

    expect(updated.dueDate).toEqual(newDueDate);

    const fetched = await prisma.task.findUnique({ where: { id: taskToday.id } });
    expect(fetched.dueDate).toEqual(newDueDate);
  });

  test('prevents non-assignee and non-manager from rescheduling task', async () => {
    const { outsider, taskToday } = await seedFixture();

    await expect(
      taskService.updateTask(outsider.id, taskToday.id, {
        dueDate: new Date('2026-11-01T00:00:00.000Z'),
      })
    ).rejects.toThrow();
  });
});
