import { jest } from '@jest/globals';
import { createFakePrisma } from './helpers/fakePrisma.js';

let prisma;
let searchService;

beforeAll(async () => {
  prisma = createFakePrisma();
  jest.unstable_mockModule('../src/config/database.js', () => ({
    prisma,
    connectDatabase: async () => {},
    disconnectDatabase: async () => {},
  }));

  searchService = await import('../src/services/search.service.js');
});

async function seedFixture() {
  const owner = await prisma.user.create({
    data: { name: 'Alice Owner', email: 'alice@search.test', passwordHash: 'hash' },
  });
  const member = await prisma.user.create({
    data: { name: 'Bob Member', email: 'bob@search.test', passwordHash: 'hash' },
  });
  const outsider = await prisma.user.create({
    data: { name: 'Charlie Outsider', email: 'charlie@search.test', passwordHash: 'hash' },
  });

  const workspace = await prisma.workspace.create({
    data: { name: 'Alpha Workspace', createdBy: owner.id },
  });
  await prisma.workspaceMember.create({
    data: { workspaceId: workspace.id, userId: owner.id, role: 'OWNER' },
  });
  await prisma.workspaceMember.create({
    data: { workspaceId: workspace.id, userId: member.id, role: 'MEMBER' },
  });

  const project = await prisma.project.create({
    data: { workspaceId: workspace.id, name: 'Secret Roadmap', createdBy: owner.id, status: 'ACTIVE' },
  });
  await prisma.projectMember.create({
    data: { projectId: project.id, userId: owner.id, role: 'MANAGER' },
  });

  const privateProject = await prisma.project.create({
    data: { workspaceId: workspace.id, name: 'Owner-only Strategy', createdBy: owner.id, status: 'ACTIVE' },
  });
  await prisma.projectMember.create({
    data: { projectId: privateProject.id, userId: owner.id, role: 'MANAGER' },
  });
  await prisma.projectMember.create({
    data: { projectId: project.id, userId: member.id, role: 'MEMBER' },
  });

  const task1 = await prisma.task.create({
    data: { projectId: project.id, creatorId: owner.id, title: 'Build Alpha Auth', status: 'TODO', priority: 'HIGH' },
  });
  const task2 = await prisma.task.create({
    data: { projectId: project.id, creatorId: member.id, title: 'Fix Search Bugs', status: 'COMPLETED', priority: 'LOW' },
  });

  const comment = await prisma.comment.create({
    data: { taskId: task1.id, userId: member.id, content: 'Searching for solutions to auth', resolved: false },
  });

  const privateTask = await prisma.task.create({
    data: { projectId: privateProject.id, creatorId: owner.id, title: 'Private Search Secret', status: 'TODO' },
  });

  return { owner, member, outsider, workspace, project, privateProject, task1, task2, privateTask, comment };
}

describe('Phase 17 — Advanced Search & Discovery Tests', () => {
  test('globalSearch returns tasks, projects, members, and discussions matching query', async () => {
    const { member, workspace } = await seedFixture();

    const res = await searchService.globalSearch(member.id, workspace.id, { q: 'Search' });

    expect(res.tasks.length).toBe(1);
    expect(res.tasks[0].title).toBe('Fix Search Bugs');
    expect(res.discussions.length).toBe(1);
    expect(res.discussions[0].content).toContain('Searching for solutions');
  });

  test('globalSearch applies status and priority filters', async () => {
    const { member, workspace } = await seedFixture();

    const todoHighRes = await searchService.globalSearch(member.id, workspace.id, {
      q: '',
      status: 'TODO',
      priority: 'HIGH',
    });

    expect(todoHighRes.tasks.length).toBe(1);
    expect(todoHighRes.tasks[0].title).toBe('Build Alpha Auth');
  });

  test('outsider receives empty search results and cannot view protected data', async () => {
    const { outsider, workspace } = await seedFixture();

    const res = await searchService.globalSearch(outsider.id, workspace.id, { q: 'Auth' });

    expect(res.tasks.length).toBe(0);
    expect(res.projects.length).toBe(0);
    expect(res.members.length).toBe(0);
  });

  test('a projectId filter cannot expose another project in the same workspace', async () => {
    const { member, workspace, privateProject } = await seedFixture();

    const res = await searchService.globalSearch(member.id, workspace.id, {
      q: 'Private Search Secret',
      projectId: privateProject.id,
    });

    expect(res.tasks).toHaveLength(0);
    expect(res.projects).toHaveLength(0);
    expect(res.discussions).toHaveLength(0);
  });

  test('getSuggestions returns autocomplete items for q', async () => {
    const { member, workspace } = await seedFixture();

    const res = await searchService.getSuggestions(member.id, workspace.id, 'Secret');

    expect(res.suggestions.length).toBeGreaterThan(0);
    expect(res.suggestions[0].title).toBe('Secret Roadmap');
    expect(res.suggestions[0].type).toBe('PROJECT');
  });
});
