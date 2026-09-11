import { jest } from '@jest/globals';
import { randomUUID } from 'crypto';
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

const WORKSPACE_ID = randomUUID();
const PROJECT_ID = randomUUID();
const TASK_ID = randomUUID();

async function seed() {
  await prisma.workspace.create({ data: { id: WORKSPACE_ID, name: 'Attachment WS', createdBy: 'u1' } });
  await prisma.workspaceMember.create({ data: { workspaceId: WORKSPACE_ID, userId: 'u1', role: 'OWNER' } });
  await prisma.workspaceMember.create({ data: { workspaceId: WORKSPACE_ID, userId: 'u2', role: 'MEMBER' } });
  await prisma.project.create({ data: { id: PROJECT_ID, workspaceId: WORKSPACE_ID, name: 'Attachment Project', createdBy: 'u1' } });
  await prisma.projectMember.create({ data: { projectId: PROJECT_ID, userId: 'u1', role: 'MANAGER' } });
  await prisma.projectMember.create({ data: { projectId: PROJECT_ID, userId: 'u2', role: 'MEMBER' } });
  await prisma.task.create({ data: { id: TASK_ID, projectId: PROJECT_ID, creatorId: 'u1', title: 'Task with attachment' } });
}

beforeEach(async () => {
  prisma._resetAll();
  await seed();
});

describe('Attachment Security', () => {
  test('non-workspace-member cannot upload', async () => {
    await expect(
      attachmentService.uploadAttachment('u3', {
        workspaceId: WORKSPACE_ID,
        file: { buffer: Buffer.from('test'), originalname: 'test.txt', size: 4 },
      })
    ).rejects.toThrow('Workspace not found');
  });

  test('upload stores opaque storage key, not filename', async () => {
    const attachment = await attachmentService.uploadAttachment('u1', {
      workspaceId: WORKSPACE_ID,
      projectId: PROJECT_ID,
      file: { buffer: Buffer.from('test'), originalname: 'my-document.pdf', size: 4 },
    });

    expect(attachment.storageKey).not.toBe('my-document.pdf');
    expect(attachment.storageKey).toMatch(/^\d+-[a-f0-9]+\.pdf$/);
  });

  test('list is scoped to requested parent', async () => {
    const attachment = await attachmentService.uploadAttachment('u1', {
      workspaceId: WORKSPACE_ID,
      taskId: TASK_ID,
      file: { buffer: Buffer.from('test'), originalname: 'task-file.txt', size: 4 },
    });

    const listed = await attachmentService.listAttachments('u1', { taskId: TASK_ID }, { take: 10 });
    expect(listed.items.find((a) => a.id === attachment.id)).toBeDefined();
  });

  test('delete requires uploader or admin/manager', async () => {
    const attachment = await attachmentService.uploadAttachment('u1', {
      workspaceId: WORKSPACE_ID,
      projectId: PROJECT_ID,
      file: { buffer: Buffer.from('test'), originalname: 'deleteme.txt', size: 4 },
    });

    await expect(
      attachmentService.deleteAttachment('u2', attachment.id)
    ).rejects.toThrow('You do not have permission to delete this attachment');

    await expect(
      attachmentService.deleteAttachment('u1', attachment.id)
    ).resolves.toEqual({ success: true });
  });
});
