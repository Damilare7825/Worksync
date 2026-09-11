import { prisma } from '../config/database.js';
import { storageService } from './storage/storage.service.js';
import {
  assertWorkspaceMembership,
  assertProjectAccess,
  isWorkspaceAdminOrOwner,
} from './authorization.service.js';
import { logActivity } from './activity.service.js';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors.js';
import { deriveSafeMimeType, validateAttachmentScope } from '../validators/attachment.validator.js';

const ATTACHMENT_INCLUDE = {
  uploader: {
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
    },
  },
};

/**
 * Asserts user access to the parent resource of an attachment request.
 */
async function resolveAndAssertParentAccess(userId, { workspaceId, projectId, taskId, commentId }) {
  let resolvedWorkspaceId = workspaceId;
  let resolvedProjectId = projectId || null;
  let resolvedTaskId = taskId || null;
  let resolvedCommentId = commentId || null;

  if (commentId) {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: { task: true },
    });
    if (!comment) {
      throw new NotFoundError('Comment not found', 'COMMENT_NOT_FOUND');
    }
    resolvedTaskId = comment.taskId;
    const task = comment.task;
    resolvedProjectId = task.projectId;
    const { project } = await assertProjectAccess(userId, resolvedProjectId);
    resolvedWorkspaceId = project.workspaceId;
    if ((taskId && taskId !== resolvedTaskId) || (projectId && projectId !== resolvedProjectId) || (workspaceId && workspaceId !== resolvedWorkspaceId)) {
      throw new ValidationError('Attachment scope does not match the comment parent');
    }
  } else if (taskId) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });
    if (!task) {
      throw new NotFoundError('Task not found', 'TASK_NOT_FOUND');
    }
    resolvedProjectId = task.projectId;
    const { project } = await assertProjectAccess(userId, resolvedProjectId);
    resolvedWorkspaceId = project.workspaceId;
    if ((projectId && projectId !== resolvedProjectId) || (workspaceId && workspaceId !== resolvedWorkspaceId)) {
      throw new ValidationError('Attachment scope does not match the task parent');
    }
  } else if (projectId) {
    const { project } = await assertProjectAccess(userId, projectId);
    resolvedWorkspaceId = project.workspaceId;
    if (workspaceId && workspaceId !== resolvedWorkspaceId) {
      throw new ValidationError('Attachment scope does not match the project parent');
    }
  } else if (workspaceId) {
    await assertWorkspaceMembership(userId, workspaceId);
  } else {
    throw new ValidationError('An attachment must be scoped to a task, comment, project, or workspace.');
  }

  return {
    workspaceId: resolvedWorkspaceId,
    projectId: resolvedProjectId,
    taskId: resolvedTaskId,
    commentId: resolvedCommentId,
  };
}

/**
 * Uploads a file and links it to a Task, Comment, Project, or Workspace.
 */
export async function uploadAttachment(userId, { workspaceId, projectId, taskId, commentId, file }) {
  if (!file || !file.buffer) {
    throw new ValidationError('No file provided for upload');
  }

  const requestedScope = validateAttachmentScope({ workspaceId, projectId, taskId, commentId });
  const scope = await resolveAndAssertParentAccess(userId, requestedScope);

  const mimeType = deriveSafeMimeType(file.buffer);
  const { storageKey, storageProvider } = await storageService.upload(
    file.buffer,
    file.originalname,
    { contentType: mimeType }
  );

  let attachment;
  try {
    attachment = await prisma.attachment.create({
      data: {
        workspaceId: scope.workspaceId,
        projectId: scope.projectId,
        taskId: scope.taskId,
        commentId: scope.commentId,
        uploaderId: userId,
        originalName: file.originalname,
        storageKey,
        mimeType,
        sizeBytes: file.size || file.buffer.length,
        storageProvider,
      },
      include: ATTACHMENT_INCLUDE,
    });
  } catch (error) {
    // A database failure must not leave a user-accessible orphan on disk.
    await storageService.delete(storageKey);
    throw error;
  }

  await logActivity({
    workspaceId: scope.workspaceId,
    projectId: scope.projectId,
    taskId: scope.taskId,
    userId,
    action: 'FILE_UPLOADED',
    entityType: 'ATTACHMENT',
    entityId: attachment.id,
    entityLabel: attachment.originalName,
    metadata: {
      originalName: attachment.originalName,
      sizeBytes: attachment.sizeBytes,
      mimeType: attachment.mimeType,
      taskId: scope.taskId,
      projectId: scope.projectId,
      commentId: scope.commentId,
    },
  });

  return attachment;
}

/**
 * Fetches attachment details after confirming user permissions.
 */
export async function getAttachmentWithAccess(userId, attachmentId) {
  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    include: ATTACHMENT_INCLUDE,
  });

  if (!attachment) {
    throw new NotFoundError('Attachment not found', 'ATTACHMENT_NOT_FOUND');
  }

  // Enforce access control based on parent entity
  try {
    await resolveAndAssertParentAccess(userId, {
      workspaceId: attachment.workspaceId,
      projectId: attachment.projectId,
      taskId: attachment.taskId,
      commentId: attachment.commentId,
    });
  } catch {
    throw new NotFoundError('Attachment not found', 'ATTACHMENT_NOT_FOUND');
  }

  return attachment;
}

/**
 * Returns readable stream for attachment download/view.
 */
export async function streamAttachment(userId, attachmentId) {
  const attachment = await getAttachmentWithAccess(userId, attachmentId);
  if (!(await storageService.exists(attachment.storageKey))) {
    throw new NotFoundError('Attachment file not found', 'ATTACHMENT_FILE_NOT_FOUND');
  }
  const stream = await storageService.getStream(attachment.storageKey);
  return { attachment, stream };
}

/**
 * Lists attachments for a specific entity.
 */
export async function listAttachments(userId, scopeInput, { skip, take } = {}) {
  const requestedScope = validateAttachmentScope(scopeInput);
  const scope = await resolveAndAssertParentAccess(userId, requestedScope);

  // Attachments denormalize parent ids (a comment file also has taskId/
  // projectId/workspaceId). Listing must return only files whose *primary*
  // scope matches the request — otherwise a project files panel would
  // accidentally include every task/comment upload in that project.
  const where = {};
  if (requestedScope.commentId) {
    where.commentId = requestedScope.commentId;
  } else if (requestedScope.taskId) {
    where.taskId = requestedScope.taskId;
    where.commentId = null;
  } else if (requestedScope.projectId) {
    where.projectId = requestedScope.projectId;
    where.taskId = null;
    where.commentId = null;
  } else {
    where.workspaceId = scope.workspaceId;
    where.projectId = null;
    where.taskId = null;
    where.commentId = null;
  }

  const [items, total] = await Promise.all([
    prisma.attachment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: ATTACHMENT_INCLUDE,
      ...(skip !== undefined ? { skip } : {}),
      ...(take !== undefined ? { take } : {}),
    }),
    prisma.attachment.count({ where }),
  ]);

  return { items, total };
}

/**
 * Deletes an attachment. Only uploader, workspace OWNER/ADMIN, or project MANAGER can delete.
 */
export async function deleteAttachment(userId, attachmentId) {
  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
  });

  if (!attachment) {
    throw new NotFoundError('Attachment not found', 'ATTACHMENT_NOT_FOUND');
  }

  const scope = await resolveAndAssertParentAccess(userId, {
    workspaceId: attachment.workspaceId,
    projectId: attachment.projectId,
    taskId: attachment.taskId,
    commentId: attachment.commentId,
  });

  // Check delete permissions
  let canDelete = attachment.uploaderId === userId;

  if (!canDelete && scope.projectId) {
    const projectMember = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: scope.projectId, userId } },
    });
    if (projectMember?.role === 'MANAGER') canDelete = true;
  }

  if (!canDelete) {
    const wsMember = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: scope.workspaceId, userId } },
    });
    if (wsMember && isWorkspaceAdminOrOwner(wsMember.role)) canDelete = true;
  }

  if (!canDelete) {
    throw new ForbiddenError('You do not have permission to delete this attachment', 'FORBIDDEN');
  }

  // Delete from storage
  await storageService.delete(attachment.storageKey);

  // Delete from database
  await prisma.attachment.delete({
    where: { id: attachmentId },
  });

  await logActivity({
    workspaceId: scope.workspaceId,
    projectId: scope.projectId,
    taskId: scope.taskId,
    userId,
    action: 'FILE_DELETED',
    entityType: 'ATTACHMENT',
    entityId: attachment.id,
    entityLabel: attachment.originalName,
    metadata: {
      originalName: attachment.originalName,
      sizeBytes: attachment.sizeBytes,
    },
  });

  return { success: true };
}
