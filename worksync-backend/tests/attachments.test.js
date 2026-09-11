import { jest } from '@jest/globals';
import { createFakePrisma } from './helpers/fakePrisma.js';

let prisma;
let attachmentService;

beforeAll(async () => {
  prisma = createFakePrisma();
  jest.unstable_mockModule('../src/config/database.js', () => ({
    prisma,
    connectDatabase: async () => {},
    disconnectDatabase: async () => {},
  }));

  attachmentService = await import('../src/services/attachment.service.js');
});

async function seedFixture() {
  const owner = await prisma.user.create({
    data: { name: 'Owner User', email: `owner-${Date.now()}@ws.test`, passwordHash: 'hash' },
  });
  const member = await prisma.user.create({
    data: { name: 'Member User', email: `member-${Date.now()}@ws.test`, passwordHash: 'hash' },
  });
  const outsider = await prisma.user.create({
    data: { name: 'Outsider User', email: `outsider-${Date.now()}@ws.test`, passwordHash: 'hash' },
  });

  const workspace = await prisma.workspace.create({
    data: { name: 'Attachment Workspace', createdBy: owner.id },
  });
  await prisma.workspaceMember.create({
    data: { workspaceId: workspace.id, userId: owner.id, role: 'OWNER' },
  });
  await prisma.workspaceMember.create({
    data: { workspaceId: workspace.id, userId: member.id, role: 'MEMBER' },
  });

  const project = await prisma.project.create({
    data: { workspaceId: workspace.id, name: 'Attachment Project', createdBy: owner.id },
  });
  await prisma.projectMember.create({
    data: { projectId: project.id, userId: owner.id, role: 'MANAGER' },
  });
  await prisma.projectMember.create({
    data: { projectId: project.id, userId: member.id, role: 'MEMBER' },
  });

  const task = await prisma.task.create({
    data: { projectId: project.id, creatorId: owner.id, title: 'Attachment Task' },
  });

  const comment = await prisma.comment.create({
    data: { taskId: task.id, userId: member.id, content: 'Comment file' },
  });

  return { owner, member, outsider, workspace, project, task, comment };
}

describe('Phase 16 — Attachments Service & Security Tests', () => {
  test('uploadAttachment creates attachment and logs activity', async () => {
    const { member, workspace, project, task } = await seedFixture();

    const attachment = await attachmentService.uploadAttachment(member.id, {
      workspaceId: workspace.id,
      projectId: project.id,
      taskId: task.id,
      file: {
        originalname: 'design-spec.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('PDF Content Dummy'),
        size: 17,
      },
    });

    expect(attachment.originalName).toBe('design-spec.pdf');
    expect(attachment.taskId).toBe(task.id);
    expect(attachment.uploaderId).toBe(member.id);

    // Verify listAttachments
    const list = await attachmentService.listAttachments(member.id, { taskId: task.id });
    expect(list.total).toBe(1);
    expect(list.items).toHaveLength(1);
    expect(list.items[0].id).toBe(attachment.id);

    // Verify activity log
    const logs = prisma.activityLog._store.filter((l) => l.action === 'FILE_UPLOADED');
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].entityLabel).toBe('design-spec.pdf');
  });

  test('outsider cannot upload or view attachments for a workspace project', async () => {
    const { outsider, workspace, project, task } = await seedFixture();

    await expect(
      attachmentService.uploadAttachment(outsider.id, {
        workspaceId: workspace.id,
        projectId: project.id,
        taskId: task.id,
        file: {
          originalname: 'secret.txt',
          mimetype: 'text/plain',
          buffer: Buffer.from('secret'),
          size: 6,
        },
      })
    ).rejects.toThrow();

    await expect(
      attachmentService.listAttachments(outsider.id, { taskId: task.id })
    ).rejects.toThrow();
  });

  test('rejects a missing attachment scope', async () => {
    const { member } = await seedFixture();

    await expect(
      attachmentService.listAttachments(member.id, {})
    ).rejects.toThrow('must be scoped');
  });

  test('uses a server-derived MIME type instead of multipart metadata', async () => {
    const { member, task } = await seedFixture();

    const attachment = await attachmentService.uploadAttachment(member.id, {
      taskId: task.id,
      file: {
        originalname: 'notes.txt',
        mimetype: 'image/svg+xml',
        buffer: Buffer.from('A plain-text attachment'),
        size: 23,
      },
    });

    expect(attachment.mimeType).toBe('text/plain; charset=utf-8');
  });

  test('deleteAttachment permits uploader and workspace OWNER, but blocks plain member on other user file', async () => {
    const { owner, member, workspace, project, task } = await seedFixture();

    // Member uploads file
    const attachment = await attachmentService.uploadAttachment(member.id, {
      workspaceId: workspace.id,
      projectId: project.id,
      taskId: task.id,
      file: {
        originalname: 'member-note.txt',
        mimetype: 'text/plain',
        buffer: Buffer.from('note'),
        size: 4,
      },
    });

    // Owner can delete member's file
    const res = await attachmentService.deleteAttachment(owner.id, attachment.id);
    expect(res.success).toBe(true);
    const check = prisma.attachment._store.find((a) => a.id === attachment.id);
    expect(check).toBeUndefined();
  });
});
