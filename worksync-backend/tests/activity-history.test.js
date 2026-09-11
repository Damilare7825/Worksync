import { jest } from '@jest/globals';
import { createFakePrisma } from './helpers/fakePrisma.js';

let prisma;
let taskService;
let commentService;
let activityService;

beforeAll(async () => {
  prisma = createFakePrisma();
  jest.unstable_mockModule('../src/config/database.js', () => ({
    prisma,
    connectDatabase: async () => {},
    disconnectDatabase: async () => {},
  }));
  // sockets/emit.js reaches for a live Socket.IO instance via getIO(); it
  // already swallows failures internally (see its own safeEmit try/catch),
  // so no mock is required for these tests to run.

  taskService = await import('../src/services/task.service.js');
  commentService = await import('../src/services/comment.service.js');
  activityService = await import('../src/services/activity.service.js');
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

describe('task history and audit trail (Phase 11)', () => {
  test('task creation, status change, and priority change each produce a distinct activity entry', async () => {
    const { manager, project } = await seedScenario();
    const task = await taskService.createTask(manager.id, project.id, { title: 'Ship v2', priority: 'LOW' });

    await taskService.updateTask(manager.id, task.id, { status: 'IN_PROGRESS', priority: 'HIGH' });

    const { items } = await activityService.listTaskActivity(task.id, { skip: 0, take: 20 });
    const actions = items.map((i) => i.action).sort();

    expect(actions).toEqual(
      expect.arrayContaining(['TASK_CREATED', 'TASK_STATUS_CHANGED', 'TASK_PRIORITY_CHANGED'])
    );
  });

  test('deleting a task preserves its activity history via the entity snapshot, not the (now-gone) FK', async () => {
    const { manager, project } = await seedScenario();
    const task = await taskService.createTask(manager.id, project.id, { title: 'Old feature' });

    await taskService.deleteTask(manager.id, task.id);

    const { items } = await activityService.listTaskActivity(task.id, { skip: 0, take: 20 });
    const actions = items.map((i) => i.action);
    expect(actions).toEqual(expect.arrayContaining(['TASK_CREATED', 'TASK_DELETED']));

    const deletedEntry = items.find((i) => i.action === 'TASK_DELETED');
    expect(deletedEntry.entityLabel).toBe('Old feature');
  });

  test('editing and deleting a comment are recorded as distinct activity actions', async () => {
    const { manager, member, project } = await seedScenario();
    const task = await taskService.createTask(manager.id, project.id, { title: 'Fix bug' });
    const comment = await commentService.createComment(member.id, task.id, { content: 'looking into it' });

    await commentService.updateComment(member.id, comment.id, { content: 'found the cause' });
    await commentService.deleteComment(member.id, comment.id);

    const { items } = await activityService.listTaskActivity(task.id, { skip: 0, take: 20 });
    const actions = items.map((i) => i.action);
    expect(actions).toEqual(
      expect.arrayContaining(['COMMENT_ADDED', 'COMMENT_EDITED', 'COMMENT_DELETED'])
    );
  });

  test('workspace activity list supports filtering by actor and action', async () => {
    const { manager, member, project, workspace } = await seedScenario();
    await taskService.createTask(manager.id, project.id, { title: 'Task A' });
    const taskB = await taskService.createTask(manager.id, project.id, { title: 'Task B', assigneeId: member.id });
    await taskService.updateTask(manager.id, taskB.id, { status: 'COMPLETED' });

    const byAction = await activityService.listWorkspaceActivity(
      workspace.id,
      { skip: 0, take: 20 },
      { action: 'TASK_STATUS_CHANGED' }
    );
    expect(byAction.items).toHaveLength(1);
    expect(byAction.items[0].action).toBe('TASK_STATUS_CHANGED');

    const byActor = await activityService.listWorkspaceActivity(
      workspace.id,
      { skip: 0, take: 20 },
      { actorId: manager.id }
    );
    expect(byActor.items.every((i) => i.userId === manager.id)).toBe(true);
    expect(byActor.total).toBeGreaterThan(0);
  });

  test('security-sensitive actions are flagged isAudit so they can be filtered from routine activity', async () => {
    const { manager, project } = await seedScenario();
    const task = await taskService.createTask(manager.id, project.id, { title: 'Regular task' });

    const { items } = await activityService.listTaskActivity(task.id, { skip: 0, take: 20 });
    const created = items.find((i) => i.action === 'TASK_CREATED');
    expect(created.isAudit).toBe(false);
  });
});
