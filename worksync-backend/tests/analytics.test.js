import { jest } from '@jest/globals';
import { createFakePrisma } from './helpers/fakePrisma.js';

let prisma;
let analyticsService;

beforeAll(async () => {
  prisma = createFakePrisma();
  jest.unstable_mockModule('../src/config/database.js', () => ({
    prisma,
    connectDatabase: async () => {},
    disconnectDatabase: async () => {},
  }));
  analyticsService = await import('../src/services/analytics.service.js');
});

async function seedFixture() {
  const owner = await prisma.user.create({ data: { name: 'Owner', email: `owner-${Date.now()}@analytics.test`, passwordHash: 'hash' } });
  const member = await prisma.user.create({ data: { name: 'Member', email: `member-${Date.now()}@analytics.test`, passwordHash: 'hash' } });
  const workspace = await prisma.workspace.create({ data: { name: 'Analytics Workspace', createdBy: owner.id } });
  await prisma.workspaceMember.create({ data: { workspaceId: workspace.id, userId: owner.id, role: 'OWNER' } });
  await prisma.workspaceMember.create({ data: { workspaceId: workspace.id, userId: member.id, role: 'MEMBER' } });
  const visibleProject = await prisma.project.create({ data: { workspaceId: workspace.id, name: 'Visible', createdBy: owner.id } });
  const privateProject = await prisma.project.create({ data: { workspaceId: workspace.id, name: 'Private', createdBy: owner.id } });
  await prisma.projectMember.create({ data: { projectId: visibleProject.id, userId: owner.id, role: 'MANAGER' } });
  await prisma.projectMember.create({ data: { projectId: visibleProject.id, userId: member.id, role: 'MEMBER' } });
  await prisma.projectMember.create({ data: { projectId: privateProject.id, userId: owner.id, role: 'MANAGER' } });
  await prisma.task.create({ data: { projectId: visibleProject.id, creatorId: owner.id, assigneeId: member.id, title: 'Completed visible', status: 'COMPLETED', completedAt: new Date() } });
  await prisma.task.create({ data: { projectId: visibleProject.id, creatorId: owner.id, assigneeId: member.id, title: 'Overdue visible', dueDate: new Date('2020-01-01') } });
  await prisma.task.create({ data: { projectId: privateProject.id, creatorId: owner.id, assigneeId: owner.id, title: 'Private task' } });
  return { member, workspace, visibleProject, privateProject };
}

describe('Phase 18 analytics', () => {
  test('personal analytics uses only projects the member can access', async () => {
    const { member, workspace } = await seedFixture();
    const analytics = await analyticsService.getPersonalAnalytics(member.id, workspace.id);

    expect(analytics.summary.totalTasks).toBe(2);
    expect(analytics.summary.completedTasks).toBe(1);
    expect(analytics.summary.overdueTasks).toBe(1);
    expect(analytics.assignedTasks).toBe(2);
  });

  test('project analytics rejects inaccessible projects', async () => {
    const { member, privateProject } = await seedFixture();
    await expect(analyticsService.getProjectAnalytics(member.id, privateProject.id)).rejects.toThrow();
  });
});
