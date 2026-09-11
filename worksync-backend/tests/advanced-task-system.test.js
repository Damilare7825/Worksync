import { jest } from '@jest/globals';
import { createFakePrisma } from './helpers/fakePrisma.js';

let prisma;
let taskService;
let checklistService;
let labelService;
let watcherService;
let dependencyService;
let recurrenceService;

beforeAll(async () => {
  prisma = createFakePrisma();
  jest.unstable_mockModule('../src/config/database.js', () => ({
    prisma,
    connectDatabase: async () => {},
    disconnectDatabase: async () => {},
  }));

  taskService = await import('../src/services/task.service.js');
  checklistService = await import('../src/services/checklist.service.js');
  labelService = await import('../src/services/label.service.js');
  watcherService = await import('../src/services/watcher.service.js');
  dependencyService = await import('../src/services/dependency.service.js');
  recurrenceService = await import('../src/services/recurrence.service.js');
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

describe('subtasks (Phase 14)', () => {
  test('a task can have subtasks, visible via getTask', async () => {
    const { manager, project } = await seedScenario();
    const parent = await taskService.createTask(manager.id, project.id, { title: 'Launch website' });
    const child = await taskService.createTask(manager.id, project.id, { title: 'Design homepage', parentTaskId: parent.id });

    const full = await taskService.getTask(manager.id, parent.id);
    expect(full.subtasks.map((s) => s.id)).toEqual([child.id]);
  });

  test('a task cannot become its own subtask', async () => {
    const { manager, project } = await seedScenario();
    const task = await taskService.createTask(manager.id, project.id, { title: 'Solo task' });
    await expect(taskService.updateTask(manager.id, task.id, { parentTaskId: task.id })).rejects.toThrow();
  });

  test('circular subtask relationships are rejected', async () => {
    const { manager, project } = await seedScenario();
    const a = await taskService.createTask(manager.id, project.id, { title: 'A' });
    const b = await taskService.createTask(manager.id, project.id, { title: 'B', parentTaskId: a.id });
    // Trying to make A a subtask of B, when B is already a subtask of A.
    await expect(taskService.updateTask(manager.id, a.id, { parentTaskId: b.id })).rejects.toThrow();
  });

  test('subtasks are excluded from the default project task list', async () => {
    const { manager, project } = await seedScenario();
    const parent = await taskService.createTask(manager.id, project.id, { title: 'Parent' });
    await taskService.createTask(manager.id, project.id, { title: 'Child', parentTaskId: parent.id });

    const { items } = await taskService.listTasks(manager.id, project.id, {}, { skip: 0, take: 20 });
    expect(items.map((t) => t.title)).toEqual(['Parent']);
  });
});

describe('checklists (Phase 14)', () => {
  test('add, complete, and delete checklist items', async () => {
    const { manager, project } = await seedScenario();
    const task = await taskService.createTask(manager.id, project.id, { title: 'Ship it' });

    const item1 = await checklistService.addItem(manager.id, task.id, { text: 'Write tests' });
    const item2 = await checklistService.addItem(manager.id, task.id, { text: 'Update docs' });

    let items = await checklistService.listItems(manager.id, task.id);
    expect(items.map((i) => i.text)).toEqual(['Write tests', 'Update docs']);

    await checklistService.updateItem(manager.id, item1.id, { completed: true });
    items = await checklistService.listItems(manager.id, task.id);
    expect(items.find((i) => i.id === item1.id).completed).toBe(true);

    await checklistService.deleteItem(manager.id, item2.id);
    items = await checklistService.listItems(manager.id, task.id);
    expect(items).toHaveLength(1);
  });

  test('the assignee can complete checklist items but not fully manage them', async () => {
    const { manager, member, project } = await seedScenario();
    const task = await taskService.createTask(manager.id, project.id, { title: 'Assigned task', assigneeId: member.id });
    const item = await checklistService.addItem(manager.id, task.id, { text: 'Do the thing' });

    await expect(checklistService.updateItem(member.id, item.id, { completed: true })).resolves.toBeTruthy();
  });

  test('a non-assignee project member cannot edit the checklist', async () => {
    const { manager, member, project } = await seedScenario();
    const task = await taskService.createTask(manager.id, project.id, { title: 'Not assigned to Mo' });
    const item = await checklistService.addItem(manager.id, task.id, { text: 'Secret step' });

    await expect(checklistService.updateItem(member.id, item.id, { completed: true })).rejects.toThrow();
  });
});

describe('labels (Phase 14)', () => {
  test('create a workspace label and assign/remove it on a task', async () => {
    const { manager, workspace, project } = await seedScenario();
    const task = await taskService.createTask(manager.id, project.id, { title: 'Tag me' });
    const label = await labelService.createLabel(manager.id, workspace.id, { name: 'bug', color: '#EF4444' });

    await labelService.addLabelToTask(manager.id, task.id, label.id);
    let full = await taskService.getTask(manager.id, task.id);
    expect(full.labels.map((l) => l.name)).toEqual(['bug']);

    await labelService.removeLabelFromTask(manager.id, task.id, label.id);
    full = await taskService.getTask(manager.id, task.id);
    expect(full.labels).toHaveLength(0);
  });

  test('duplicate label names in the same workspace are rejected', async () => {
    const { manager, workspace } = await seedScenario();
    await labelService.createLabel(manager.id, workspace.id, { name: 'urgent' });
    await expect(labelService.createLabel(manager.id, workspace.id, { name: 'urgent' })).rejects.toThrow();
  });

  test('tasks can be filtered by label', async () => {
    const { manager, workspace, project } = await seedScenario();
    const label = await labelService.createLabel(manager.id, workspace.id, { name: 'design' });
    const tagged = await taskService.createTask(manager.id, project.id, { title: 'Tagged task' });
    await taskService.createTask(manager.id, project.id, { title: 'Untagged task' });
    await labelService.addLabelToTask(manager.id, tagged.id, label.id);

    const { items } = await taskService.listTasks(manager.id, project.id, { labelId: label.id }, { skip: 0, take: 20 });
    expect(items.map((t) => t.title)).toEqual(['Tagged task']);
  });
});

describe('watchers (Phase 14)', () => {
  test('a project member can watch and unwatch a task', async () => {
    const { manager, member, project } = await seedScenario();
    const task = await taskService.createTask(manager.id, project.id, { title: 'Watch me' });

    await watcherService.watchTask(member.id, task.id);
    let watchers = await watcherService.listWatchers(manager.id, task.id);
    expect(watchers.map((w) => w.userId)).toContain(member.id);

    await watcherService.unwatchTask(member.id, task.id);
    watchers = await watcherService.listWatchers(manager.id, task.id);
    expect(watchers.map((w) => w.userId)).not.toContain(member.id);
  });

  test('watching the same task twice is a safe no-op', async () => {
    const { manager, member, project } = await seedScenario();
    const task = await taskService.createTask(manager.id, project.id, { title: 'Dup watch' });
    await watcherService.watchTask(member.id, task.id);
    await watcherService.watchTask(member.id, task.id);
    const watchers = await watcherService.listWatchers(manager.id, task.id);
    expect(watchers.filter((w) => w.userId === member.id)).toHaveLength(1);
  });
});

describe('task dependencies (Phase 14)', () => {
  test('a task can depend on another', async () => {
    const { manager, project } = await seedScenario();
    const design = await taskService.createTask(manager.id, project.id, { title: 'Design' });
    const build = await taskService.createTask(manager.id, project.id, { title: 'Build' });

    await dependencyService.addDependency(manager.id, build.id, design.id);
    const full = await taskService.getTask(manager.id, build.id);
    expect(full.dependencies.map((d) => d.task.id)).toEqual([design.id]);

    const designFull = await taskService.getTask(manager.id, design.id);
    expect(designFull.dependents.map((d) => d.task.id)).toEqual([build.id]);
  });

  test('a task cannot depend on itself', async () => {
    const { manager, project } = await seedScenario();
    const task = await taskService.createTask(manager.id, project.id, { title: 'Solo' });
    await expect(dependencyService.addDependency(manager.id, task.id, task.id)).rejects.toThrow();
  });

  test('circular dependencies are rejected', async () => {
    const { manager, project } = await seedScenario();
    const a = await taskService.createTask(manager.id, project.id, { title: 'A' });
    const b = await taskService.createTask(manager.id, project.id, { title: 'B' });
    await dependencyService.addDependency(manager.id, b.id, a.id); // B depends on A
    await expect(dependencyService.addDependency(manager.id, a.id, b.id)).rejects.toThrow(); // A depends on B -> cycle
  });

  test('a dependency can be removed', async () => {
    const { manager, project } = await seedScenario();
    const a = await taskService.createTask(manager.id, project.id, { title: 'A' });
    const b = await taskService.createTask(manager.id, project.id, { title: 'B' });
    await dependencyService.addDependency(manager.id, b.id, a.id);
    await dependencyService.removeDependency(manager.id, b.id, a.id);
    const full = await taskService.getTask(manager.id, b.id);
    expect(full.dependencies).toHaveLength(0);
  });
});

describe('recurring tasks (Phase 14)', () => {
  test('computeNextOccurrence advances by the given pattern/interval', () => {
    const start = new Date('2026-01-01T00:00:00.000Z');
    expect(recurrenceService.computeNextOccurrence(start, 'DAILY', 1).toISOString()).toBe('2026-01-02T00:00:00.000Z');
    expect(recurrenceService.computeNextOccurrence(start, 'WEEKLY', 2).toISOString()).toBe('2026-01-15T00:00:00.000Z');
    expect(recurrenceService.computeNextOccurrence(start, 'MONTHLY', 1).toISOString()).toBe('2026-02-01T00:00:00.000Z');
  });

  test('setting a recurrence rule schedules the next run', async () => {
    const { manager, project } = await seedScenario();
    const task = await taskService.createTask(manager.id, project.id, {
      title: 'Weekly sync',
      dueDate: new Date('2026-01-01T00:00:00.000Z'),
    });

    const rule = await recurrenceService.setRecurrence(manager.id, task.id, { pattern: 'WEEKLY', interval: 1 });
    expect(rule.nextRunAt.toISOString()).toBe('2026-01-08T00:00:00.000Z');
  });

  test('generateOccurrenceIfDue only fires once a rule is actually due, and advances nextRunAt', async () => {
    const { manager, project } = await seedScenario();
    const task = await taskService.createTask(manager.id, project.id, {
      title: 'Daily standup',
      dueDate: new Date('2026-01-01T00:00:00.000Z'),
    });
    const rule = await recurrenceService.setRecurrence(manager.id, task.id, { pattern: 'DAILY', interval: 1 });

    // Not due yet.
    const notDue = await recurrenceService.generateOccurrenceIfDue(rule.id, { now: new Date('2026-01-01T00:00:00.000Z') });
    expect(notDue).toBeNull();

    // Due now.
    const generated = await recurrenceService.generateOccurrenceIfDue(rule.id, { now: new Date('2026-01-02T00:00:01.000Z') });
    expect(generated).toBeTruthy();
    expect(generated.title).toBe('Daily standup');
    expect(generated.generatedFromRuleId).toBe(rule.id);

    // Calling again immediately (same "now") must not double-generate.
    const again = await recurrenceService.generateOccurrenceIfDue(rule.id, { now: new Date('2026-01-02T00:00:01.000Z') });
    expect(again).toBeNull();
  });

  test('a plain member cannot set recurrence on a task', async () => {
    const { manager, member, project } = await seedScenario();
    const task = await taskService.createTask(manager.id, project.id, { title: 'Managed only' });
    await expect(
      recurrenceService.setRecurrence(member.id, task.id, { pattern: 'DAILY', interval: 1 })
    ).rejects.toThrow();
  });
});
