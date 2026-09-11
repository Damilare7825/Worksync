import { jest } from '@jest/globals';
import { createFakePrisma } from './helpers/fakePrisma.js';

let prisma;
let taskService;
let commentService;

beforeAll(async () => {
  prisma = createFakePrisma();
  jest.unstable_mockModule('../src/config/database.js', () => ({
    prisma,
    connectDatabase: async () => {},
    disconnectDatabase: async () => {},
  }));

  taskService = await import('../src/services/task.service.js');
  commentService = await import('../src/services/comment.service.js');
});

async function seedScenario() {
  const manager = await prisma.user.create({ data: { name: 'Manager Mary', email: 'mary@ws.test', passwordHash: 'x' } });
  const member = await prisma.user.create({ data: { name: 'Member Mo', email: 'mo@ws.test', passwordHash: 'x' } });
  const outsider = await prisma.user.create({ data: { name: 'Outsider Oz', email: 'oz@ws.test', passwordHash: 'x' } });

  const workspace = await prisma.workspace.create({ data: { name: 'Acme', createdBy: manager.id } });
  await prisma.workspaceMember.create({ data: { workspaceId: workspace.id, userId: manager.id, role: 'OWNER' } });
  await prisma.workspaceMember.create({ data: { workspaceId: workspace.id, userId: member.id, role: 'MEMBER' } });

  const project = await prisma.project.create({
    data: { workspaceId: workspace.id, name: 'Website Redesign', createdBy: manager.id, status: 'ACTIVE' },
  });
  await prisma.projectMember.create({ data: { projectId: project.id, userId: manager.id, role: 'MANAGER' } });
  await prisma.projectMember.create({ data: { projectId: project.id, userId: member.id, role: 'MEMBER' } });

  const task = await taskService.createTask(manager.id, project.id, { title: 'Design the homepage' });

  return { manager, member, outsider, workspace, project, task };
}

describe('threaded discussions (Phase 15)', () => {
  test('a comment can receive replies, nested under it in listComments', async () => {
    const { manager, member, task } = await seedScenario();
    const root = await commentService.createComment(manager.id, task.id, { content: 'What do we think of this layout?' });
    await commentService.createComment(member.id, task.id, { content: 'Looks great!', parentCommentId: root.id });

    const { items: comments } = await commentService.listComments(manager.id, task.id);
    expect(comments).toHaveLength(1);
    expect(comments[0].replies).toHaveLength(1);
    expect(comments[0].replies[0].content).toBe('Looks great!');
  });

  test('replying to a reply is rejected — flat root+replies only', async () => {
    const { manager, member, task } = await seedScenario();
    const root = await commentService.createComment(manager.id, task.id, { content: 'Root' });
    const reply = await commentService.createComment(member.id, task.id, { content: 'Reply', parentCommentId: root.id });

    await expect(
      commentService.createComment(manager.id, task.id, { content: 'Reply to a reply', parentCommentId: reply.id })
    ).rejects.toThrow();
  });

  test('a reply must belong to the same task as its parent', async () => {
    const { manager, project, task } = await seedScenario();
    const otherTask = await taskService.createTask(manager.id, project.id, { title: 'Other task' });
    const root = await commentService.createComment(manager.id, task.id, { content: 'Root on task A' });

    await expect(
      commentService.createComment(manager.id, otherTask.id, { content: 'Cross-task reply', parentCommentId: root.id })
    ).rejects.toThrow();
  });
});

describe('mentions (Phase 15)', () => {
  test('mentioning a valid project member creates a mention and notifies them', async () => {
    const { manager, member, task } = await seedScenario();
    const comment = await commentService.createComment(manager.id, task.id, {
      content: '@Member Mo can you take a look?',
      mentionedUserIds: [member.id],
    });

    expect(comment.mentions.map((m) => m.userId)).toContain(member.id);

    const notifications = await prisma.notification.findMany({ where: { userId: member.id, type: 'MENTION' } });
    expect(notifications.length).toBeGreaterThan(0);
  });

  test('mentioning someone who is not a project member is silently dropped, not an error', async () => {
    const { manager, outsider, task } = await seedScenario();
    const comment = await commentService.createComment(manager.id, task.id, {
      content: 'ping @Outsider Oz',
      mentionedUserIds: [outsider.id],
    });

    expect(comment.mentions).toHaveLength(0);
    const notifications = await prisma.notification.findMany({ where: { userId: outsider.id, type: 'MENTION' } });
    expect(notifications).toHaveLength(0);
  });

  test('editing a comment can update its mentions', async () => {
    const { manager, member, task } = await seedScenario();
    const comment = await commentService.createComment(manager.id, task.id, { content: 'No mentions yet' });
    expect(comment.mentions).toHaveLength(0);

    const updated = await commentService.updateComment(manager.id, comment.id, {
      content: 'Now mentioning @Member Mo',
      mentionedUserIds: [member.id],
    });
    expect(updated.mentions.map((m) => m.userId)).toContain(member.id);
  });
});

describe('reactions (Phase 15)', () => {
  test('a user can react to a comment, and reactions are visible on it', async () => {
    const { manager, member, task } = await seedScenario();
    const comment = await commentService.createComment(manager.id, task.id, { content: 'Ship it?' });

    await commentService.addReaction(member.id, comment.id, '👍');
    const { items: comments } = await commentService.listComments(manager.id, task.id);
    expect(comments[0].reactions).toHaveLength(1);
    expect(comments[0].reactions[0].emoji).toBe('👍');
  });

  test('reacting twice with the same emoji is a safe no-op (no duplicate)', async () => {
    const { manager, member, task } = await seedScenario();
    const comment = await commentService.createComment(manager.id, task.id, { content: 'Thoughts?' });

    await commentService.addReaction(member.id, comment.id, '🎉');
    await commentService.addReaction(member.id, comment.id, '🎉');
    const { items: comments } = await commentService.listComments(manager.id, task.id);
    expect(comments[0].reactions.filter((r) => r.emoji === '🎉')).toHaveLength(1);
  });

  test('a reaction can be removed', async () => {
    const { manager, member, task } = await seedScenario();
    const comment = await commentService.createComment(manager.id, task.id, { content: 'React then unreact' });

    await commentService.addReaction(member.id, comment.id, '👀');
    await commentService.removeReaction(member.id, comment.id, '👀');
    const { items: comments } = await commentService.listComments(manager.id, task.id);
    expect(comments[0].reactions).toHaveLength(0);
  });

  test('the same user can add multiple distinct emoji reactions', async () => {
    const { manager, member, task } = await seedScenario();
    const comment = await commentService.createComment(manager.id, task.id, { content: 'Multi-react' });

    await commentService.addReaction(member.id, comment.id, '👍');
    await commentService.addReaction(member.id, comment.id, '🚀');
    const { items: comments } = await commentService.listComments(manager.id, task.id);
    expect(comments[0].reactions).toHaveLength(2);
  });
});

describe('discussion resolution (Phase 15)', () => {
  test('a root comment can be resolved and reopened', async () => {
    const { manager, task } = await seedScenario();
    const comment = await commentService.createComment(manager.id, task.id, { content: 'Blocking question' });

    const resolved = await commentService.resolveDiscussion(manager.id, comment.id);
    expect(resolved.resolved).toBe(true);
    expect(resolved.resolvedById).toBe(manager.id);

    const reopened = await commentService.reopenDiscussion(manager.id, comment.id);
    expect(reopened.resolved).toBe(false);
    expect(reopened.resolvedById).toBeNull();
  });

  test('a reply cannot be resolved independently of its thread', async () => {
    const { manager, member, task } = await seedScenario();
    const root = await commentService.createComment(manager.id, task.id, { content: 'Root' });
    const reply = await commentService.createComment(member.id, task.id, { content: 'Reply', parentCommentId: root.id });

    await expect(commentService.resolveDiscussion(manager.id, reply.id)).rejects.toThrow();
  });

  test('any project member can resolve a discussion, not just managers', async () => {
    const { member, task } = await seedScenario();
    const comment = await commentService.createComment(member.id, task.id, { content: 'My own question' });
    await expect(commentService.resolveDiscussion(member.id, comment.id)).resolves.toBeTruthy();
  });

  test('resolving an already-resolved discussion is a safe no-op', async () => {
    const { manager, task } = await seedScenario();
    const comment = await commentService.createComment(manager.id, task.id, { content: 'Question' });
    await commentService.resolveDiscussion(manager.id, comment.id);
    const again = await commentService.resolveDiscussion(manager.id, comment.id);
    expect(again.resolved).toBe(true);
  });
});

describe('comment permissions still hold (Phase 15 regression check)', () => {
  test('only the author or a project manager can edit/delete a comment', async () => {
    const { manager, member, _outsider, task } = await seedScenario();
    const comment = await commentService.createComment(member.id, task.id, { content: 'Mine' });

    await expect(commentService.updateComment(manager.id, comment.id, { content: 'edited by manager' })).resolves.toBeTruthy();

    const other = await commentService.createComment(manager.id, task.id, { content: 'Managers comment' });
    await expect(commentService.deleteComment(member.id, other.id)).rejects.toThrow();
  });
});
