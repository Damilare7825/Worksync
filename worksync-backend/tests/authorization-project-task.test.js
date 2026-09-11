import { jest } from '@jest/globals';
import { createFakePrisma } from './helpers/fakePrisma.js';

let prisma;
let authorizationService;
let taskService;

beforeAll(async () => {
  prisma = createFakePrisma();
  jest.unstable_mockModule('../src/config/database.js', () => ({
    prisma,
    connectDatabase: async () => {},
    disconnectDatabase: async () => {},
  }));

  authorizationService = await import('../src/services/authorization.service.js');
  taskService = await import('../src/services/task.service.js');
});

async function seedScenario() {
  const owner = await prisma.user.create({ data: { name: 'Owner', email: 'owner@ws.test', passwordHash: 'x' } });
  const manager = await prisma.user.create({ data: { name: 'Manager Mary', email: 'mary@ws.test', passwordHash: 'x' } });
  const member = await prisma.user.create({ data: { name: 'Member Mo', email: 'mo@ws.test', passwordHash: 'x' } });
  const outsider = await prisma.user.create({ data: { name: 'Outsider Otis', email: 'otis@ws.test', passwordHash: 'x' } });
  const stranger = await prisma.user.create({ data: { name: 'Stranger', email: 'stranger@ws.test', passwordHash: 'x' } });

  const workspace = await prisma.workspace.create({ data: { name: 'Acme', createdBy: owner.id } });
  await prisma.workspaceMember.create({ data: { workspaceId: workspace.id, userId: owner.id, role: 'OWNER' } });
  // Both manager and member are plain workspace MEMBERs — their project
  // authority comes entirely from their ProjectMember row, not their
  // workspace role. This is the exact distinction the spec calls out.
  await prisma.workspaceMember.create({ data: { workspaceId: workspace.id, userId: manager.id, role: 'MEMBER' } });
  await prisma.workspaceMember.create({ data: { workspaceId: workspace.id, userId: member.id, role: 'MEMBER' } });
  await prisma.workspaceMember.create({ data: { workspaceId: workspace.id, userId: outsider.id, role: 'MEMBER' } });
  // `stranger` deliberately has no membership in this workspace at all.

  const project = await prisma.project.create({
    data: { workspaceId: workspace.id, name: 'Website Redesign', createdBy: owner.id, status: 'ACTIVE' },
  });
  await prisma.projectMember.create({ data: { projectId: project.id, userId: manager.id, role: 'MANAGER' } });
  await prisma.projectMember.create({ data: { projectId: project.id, userId: member.id, role: 'MEMBER' } });
  // `outsider` is a workspace member but NOT a member of this project.

  return { owner, manager, member, outsider, stranger, workspace, project };
}

describe('project access authorization', () => {
  test('workspace OWNER can access a project with no explicit ProjectMember row', async () => {
    const { owner, project } = await seedScenario();
    await expect(authorizationService.assertProjectAccess(owner.id, project.id)).resolves.toBeTruthy();
  });

  test('a workspace MEMBER with no ProjectMember row cannot access the project', async () => {
    const { outsider, project } = await seedScenario();
    await expect(authorizationService.assertProjectAccess(outsider.id, project.id)).rejects.toMatchObject({
      code: 'PROJECT_NOT_FOUND',
    });
  });

  test('a workspace MEMBER who is an explicit ProjectMember can access the project', async () => {
    const { member, project } = await seedScenario();
    await expect(authorizationService.assertProjectAccess(member.id, project.id)).resolves.toBeTruthy();
  });

  test('a user with no workspace membership at all cannot access the project (cross-workspace rejection)', async () => {
    const { stranger, project } = await seedScenario();
    await expect(authorizationService.assertProjectAccess(stranger.id, project.id)).rejects.toMatchObject({
      code: 'PROJECT_NOT_FOUND',
    });
  });
});

describe('project management authorization (Manager vs Member)', () => {
  test('workspace OWNER can manage any project in their workspace', async () => {
    const { owner, project } = await seedScenario();
    await expect(authorizationService.assertProjectManage(owner.id, project.id)).resolves.toBeTruthy();
  });

  test('a project MANAGER (plain workspace MEMBER) can manage the project', async () => {
    const { manager, project } = await seedScenario();
    await expect(authorizationService.assertProjectManage(manager.id, project.id)).resolves.toBeTruthy();
  });

  test('a project MEMBER (not MANAGER) cannot manage the project', async () => {
    const { member, project } = await seedScenario();
    await expect(authorizationService.assertProjectManage(member.id, project.id)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});

describe('task assignment enforcement', () => {
  test('a project MANAGER can create and assign a task to a valid project member', async () => {
    const { manager, member, project } = await seedScenario();
    const task = await taskService.createTask(manager.id, project.id, {
      title: 'Build the login page',
      assigneeId: member.id,
    });
    expect(task.assigneeId).toBe(member.id);
    expect(task.status).toBe('TODO'); // backend/DB default — never set by the caller
  });

  test('a task cannot be assigned to someone who is not a member of the project', async () => {
    const { manager, outsider, project } = await seedScenario();
    await expect(
      taskService.createTask(manager.id, project.id, { title: 'Ship it', assigneeId: outsider.id })
    ).rejects.toMatchObject({ code: 'ASSIGNEE_NOT_PROJECT_MEMBER' });
  });

  test('a plain project MEMBER (not MANAGER) cannot create tasks in the project', async () => {
    const { member, project } = await seedScenario();
    await expect(
      taskService.createTask(member.id, project.id, { title: 'Sneaky task' })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  test('a workspace OWNER can create and assign tasks even without an explicit ProjectMember row', async () => {
    const { owner, manager, project } = await seedScenario();
    const task = await taskService.createTask(owner.id, project.id, {
      title: 'Owner-created task',
      assigneeId: manager.id,
    });
    expect(task.assigneeId).toBe(manager.id);
  });
});
