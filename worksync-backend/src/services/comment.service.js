import { prisma } from '../config/database.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/errors.js';
import { assertProjectAccess, assertProjectManage } from './authorization.service.js';
import { logActivity } from './activity.service.js';
import { createNotification } from './notification.service.js';
import { emitToProject } from '../sockets/emit.js';
import { getOrCreateNotificationPreferences } from './user.service.js';

const COMMENT_INCLUDE = {
  user: { select: { id: true, name: true, avatar: true } },
  resolvedBy: { select: { id: true, name: true } },
  mentions: { include: { user: { select: { id: true, name: true } } } },
  reactions: true,
};

const MAX_REPLIES_PER_DISCUSSION = 100;

async function getTaskOr404(taskId) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) {
    throw new NotFoundError('Task not found', 'TASK_NOT_FOUND');
  }
  return task;
}

async function getCommentOr404(commentId) {
  const comment = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!comment) {
    throw new NotFoundError('Comment not found', 'COMMENT_NOT_FOUND');
  }
  return comment;
}

/**
 * Mentions are never inferred from free text — the frontend's mention
 * picker resolves "@name" to a concrete user id as you type (same
 * approach Slack/GitHub use), and this validates each id is an actual
 * member of the task's project before creating a CommentMention row or
 * sending a notification. Silently drops ids that aren't valid project
 * members rather than erroring, since a stale/removed member id in the
 * payload shouldn't block posting the comment itself.
 */
async function resolveValidMentions(projectId, mentionedUserIds = []) {
  if (mentionedUserIds.length === 0) return [];
  const members = await prisma.projectMember.findMany({
    where: { projectId, userId: { in: mentionedUserIds } },
  });
  return [...new Set(members.map((m) => m.userId))];
}

// Anyone with access to the task's project can comment — matches "Comment"
// being a permission both Project Managers and Project Members have.
export async function createComment(userId, taskId, { content, parentCommentId, mentionedUserIds }) {
  const task = await getTaskOr404(taskId);
  const { project } = await assertProjectAccess(userId, task.projectId);

  // Cache notification preferences by userId to avoid repeated DB fetches
  const preferencesCache = new Map();

  if (parentCommentId) {
    const parent = await getCommentOr404(parentCommentId);
    if (parent.taskId !== taskId) {
      throw new ValidationError('Parent comment must belong to the same task');
    }
    if (parent.parentCommentId) {
      // Deliberately flat: a reply-to-a-reply is attached to the same
      // root instead, keeping this a simple root+replies model rather
      // than unlimited nesting, per spec.
      throw new ValidationError('Replies cannot themselves be replied to — reply to the root comment instead');
    }
  }

  const validMentionIds = await resolveValidMentions(task.projectId, mentionedUserIds);

  const comment = await prisma.comment.create({
    data: {
      taskId,
      userId,
      content,
      parentCommentId: parentCommentId || null,
    },
    include: COMMENT_INCLUDE,
  });

  if (validMentionIds.length > 0) {
    await Promise.all(
      validMentionIds.map((mentionedUserId) =>
        prisma.commentMention.create({ data: { commentId: comment.id, userId: mentionedUserId } })
      )
    );
    comment.mentions = await prisma.commentMention.findMany({
      where: { commentId: comment.id },
      include: { user: { select: { id: true, name: true } } },
    });
  }

  await logActivity({
    workspaceId: project.workspaceId,
    projectId: task.projectId,
    taskId,
    userId,
    action: parentCommentId ? 'COMMENT_REPLIED' : 'COMMENT_ADDED',
    metadata: { commentId: comment.id },
    entityType: 'COMMENT',
    entityId: comment.id,
    entityLabel: task.title,
  });

  const alreadyNotified = new Set([userId]);

  // Reply notifies the parent comment's author specifically — a distinct,
  // more relevant signal than the generic "new comment" notice.
  if (parentCommentId) {
    const parent = await getCommentOr404(parentCommentId);
    if (!alreadyNotified.has(parent.userId)) {
      // Get cached preferences or fetch and cache them
      let parentPreferences = preferencesCache.get(parent.userId);
      if (!parentPreferences) {
        parentPreferences = await getOrCreateNotificationPreferences(parent.userId);
        preferencesCache.set(parent.userId, parentPreferences);
      }
      await createNotification({
        userId: parent.userId,
        type: 'REPLY',
        title: 'New reply',
        message: `Someone replied to your comment on "${task.title}"`,
      }, parentPreferences);
      alreadyNotified.add(parent.userId);
    }
  }

  // Mentioned users get a distinct MENTION notification, ahead of (and
  // deduplicated against) the broader creator/assignee/watcher notice
  // below — being @mentioned is a stronger, more specific signal than
  // just being generically notified about task activity.
  for (const mentionedUserId of validMentionIds) {
    if (alreadyNotified.has(mentionedUserId)) continue;
    // Get cached preferences or fetch and cache them
    let mentionedPreferences = preferencesCache.get(mentionedUserId);
    if (!mentionedPreferences) {
      mentionedPreferences = await getOrCreateNotificationPreferences(mentionedUserId);
      preferencesCache.set(mentionedUserId, mentionedPreferences);
    }
    await createNotification({
      userId: mentionedUserId,
      type: 'MENTION',
      title: 'You were mentioned',
      message: `You were mentioned in a comment on "${task.title}"`,
    }, mentionedPreferences);
    alreadyNotified.add(mentionedUserId);
  }

  const notifyTargets = new Set(
    [task.creatorId, task.assigneeId].filter((id) => id && !alreadyNotified.has(id))
  );
  for (const targetUserId of notifyTargets) {
    // Get cached preferences or fetch and cache them
    let targetPreferences = preferencesCache.get(targetUserId);
    if (!targetPreferences) {
      targetPreferences = await getOrCreateNotificationPreferences(targetUserId);
      preferencesCache.set(targetUserId, targetPreferences);
    }
    await createNotification({
      userId: targetUserId,
      type: 'COMMENT',
      title: 'New comment',
      message: `New comment on "${task.title}"`,
    }, targetPreferences);
    alreadyNotified.add(targetUserId);
  }

  // Watchers get the same notification too, minus everyone already
  // notified above (creator/assignee/mentioned/repliee) and the commenter
  // themselves.
  const watchers = await prisma.taskWatcher.findMany({ where: { taskId } });
  await Promise.all(
    watchers
      .filter((w) => !alreadyNotified.has(w.userId))
      .map(async (w) => {
        // Get cached preferences or fetch and cache them
        let watcherPreferences = preferencesCache.get(w.userId);
        if (!watcherPreferences) {
          watcherPreferences = await getOrCreateNotificationPreferences(w.userId);
          preferencesCache.set(w.userId, watcherPreferences);
        }
        return createNotification({
          userId: w.userId,
          type: 'COMMENT',
          title: 'New comment',
          message: `New comment on "${task.title}"`,
        }, watcherPreferences);
      })
  );

  emitToProject(task.projectId, 'comment.created', { comment, taskId, actorId: userId });

  return comment;
}

/**
 * Returns root comments (discussions) for a task, each with its replies
 * nested underneath — a simple two-level structure, not a flat list the
 * client has to thread itself.
 */
export async function listComments(userId, taskId, { skip, take } = {}) {
  const task = await getTaskOr404(taskId);
  await assertProjectAccess(userId, task.projectId);

  const where = { taskId, parentCommentId: null };
  const [roots, total] = await Promise.all([
    prisma.comment.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: {
        ...COMMENT_INCLUDE,
        replies: {
          orderBy: { createdAt: 'asc' },
          take: MAX_REPLIES_PER_DISCUSSION,
          include: COMMENT_INCLUDE,
        },
        _count: { select: { replies: true } },
      },
      ...(skip !== undefined ? { skip } : {}),
      ...(take !== undefined ? { take } : {}),
    }),
    prisma.comment.count({ where }),
  ]);

  return {
    items: roots.map(({ _count, ...root }) => ({
      ...root,
      replyCount: _count.replies,
      repliesTruncated: _count.replies > MAX_REPLIES_PER_DISCUSSION,
    })),
    total,
  };
}

/**
 * Edit/delete: the comment's author, or a project manager / workspace
 * OWNER-ADMIN (moderation). No one else, even with project access.
 */
async function assertCanModifyComment(userId, comment, task) {
  if (comment.userId === userId) return;
  try {
    await assertProjectManage(userId, task.projectId);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      throw new ForbiddenError('You can only edit or delete your own comments', 'FORBIDDEN');
    }
    throw err;
  }
}

export async function updateComment(userId, commentId, { content, mentionedUserIds }) {
  const comment = await getCommentOr404(commentId);
  const task = await getTaskOr404(comment.taskId);
  const { project } = await assertProjectAccess(userId, task.projectId);
  await assertCanModifyComment(userId, comment, task);

  const validMentionIds =
    mentionedUserIds !== undefined ? await resolveValidMentions(task.projectId, mentionedUserIds) : undefined;

  const updated = await prisma.comment.update({
    where: { id: commentId },
    data: { content },
    include: COMMENT_INCLUDE,
  });

  if (validMentionIds !== undefined) {
    const existingMentions = await prisma.commentMention.findMany({ where: { commentId } });
    await Promise.all(existingMentions.map((m) => prisma.commentMention.delete({ where: { id: m.id } })));
    await Promise.all(
      validMentionIds.map((mentionedUserId) =>
        prisma.commentMention.create({ data: { commentId, userId: mentionedUserId } })
      )
    );
    updated.mentions = await prisma.commentMention.findMany({
      where: { commentId },
      include: { user: { select: { id: true, name: true } } },
    });
  }

  await logActivity({
    workspaceId: project.workspaceId,
    projectId: task.projectId,
    taskId: task.id,
    userId,
    action: 'COMMENT_EDITED',
    metadata: { commentId },
    entityType: 'COMMENT',
    entityId: commentId,
    entityLabel: task.title,
  });

  emitToProject(task.projectId, 'comment.updated', { comment: updated, taskId: task.id, actorId: userId });

  return updated;
}

export async function deleteComment(userId, commentId) {
  const comment = await getCommentOr404(commentId);
  const task = await getTaskOr404(comment.taskId);
  const { project } = await assertProjectAccess(userId, task.projectId);
  await assertCanModifyComment(userId, comment, task);

  // Log before deleting, same reasoning as task deletion — the comment
  // row disappears but the fact it happened, and who did it, shouldn't.
  await logActivity({
    workspaceId: project.workspaceId,
    projectId: task.projectId,
    taskId: task.id,
    userId,
    action: 'COMMENT_DELETED',
    metadata: { commentId },
    entityType: 'COMMENT',
    entityId: commentId,
    entityLabel: task.title,
  });

  // Cascades to replies/mentions/reactions of this comment automatically.
  await prisma.comment.delete({ where: { id: commentId } });

  emitToProject(task.projectId, 'comment.deleted', {
    commentId,
    taskId: task.id,
    projectId: task.projectId,
    actorId: userId,
  });
}

// --- Reactions ---------------------------------------------------------------

export async function addReaction(userId, commentId, emoji) {
  const comment = await getCommentOr404(commentId);
  const task = await getTaskOr404(comment.taskId);
  await assertProjectAccess(userId, task.projectId);

  // Cache notification preferences by userId to avoid repeated DB fetches
  const preferencesCache = new Map();

  const existing = await prisma.commentReaction.findUnique({
    where: { commentId_userId_emoji: { commentId, userId, emoji } },
  });
  if (existing) return existing;

  const reaction = await prisma.commentReaction.create({ data: { commentId, userId, emoji } });

  if (comment.userId !== userId) {
    // Get cached preferences or fetch and cache them
    let reactionPreferences = preferencesCache.get(comment.userId);
    if (!reactionPreferences) {
      reactionPreferences = await getOrCreateNotificationPreferences(comment.userId);
      preferencesCache.set(comment.userId, reactionPreferences);
    }
    await createNotification({
      userId: comment.userId,
      type: 'REACTION',
      title: 'New reaction',
      message: `Someone reacted ${emoji} to your comment on "${task.title}"`,
    }, reactionPreferences);
  }

  emitToProject(task.projectId, 'comment.reaction.changed', { commentId, taskId: task.id, actorId: userId });
  return reaction;
}

export async function removeReaction(userId, commentId, emoji) {
  const comment = await getCommentOr404(commentId);
  const task = await getTaskOr404(comment.taskId);
  await assertProjectAccess(userId, task.projectId);

  const existing = await prisma.commentReaction.findUnique({
    where: { commentId_userId_emoji: { commentId, userId, emoji } },
  });
  if (!existing) return;

  await prisma.commentReaction.delete({ where: { commentId_userId_emoji: { commentId, userId, emoji } } });
  emitToProject(task.projectId, 'comment.reaction.changed', { commentId, taskId: task.id, actorId: userId });
}

// --- Resolution ----------------------------------------------------------------

/**
 * Resolving/reopening is available to anyone with project access (not
 * just managers) — closer to how PR/issue conversation resolution works
 * in most tools: collaborative, not a restricted moderation action. Only
 * meaningful on a root comment (a "discussion"); replies can't be
 * resolved independently of their thread.
 */
export async function resolveDiscussion(userId, commentId) {
  const comment = await getCommentOr404(commentId);
  const task = await getTaskOr404(comment.taskId);
  const { project } = await assertProjectAccess(userId, task.projectId);

  if (comment.parentCommentId) {
    throw new ValidationError('Only a root comment (discussion) can be resolved — resolve its thread instead');
  }
  if (comment.resolved) return comment;

  const updated = await prisma.comment.update({
    where: { id: commentId },
    data: { resolved: true, resolvedById: userId, resolvedAt: new Date() },
    include: COMMENT_INCLUDE,
  });

  await logActivity({
    workspaceId: project.workspaceId,
    projectId: task.projectId,
    taskId: task.id,
    userId,
    action: 'DISCUSSION_RESOLVED',
    metadata: { commentId },
    entityType: 'COMMENT',
    entityId: commentId,
    entityLabel: task.title,
  });

  if (comment.userId !== userId) {
    await createNotification({
      userId: comment.userId,
      type: 'DISCUSSION_RESOLVED',
      title: 'Discussion resolved',
      message: `Your discussion on "${task.title}" was marked resolved`,
    });
  }

  emitToProject(task.projectId, 'comment.updated', { comment: updated, taskId: task.id, actorId: userId });
  return updated;
}

export async function reopenDiscussion(userId, commentId) {
  const comment = await getCommentOr404(commentId);
  const task = await getTaskOr404(comment.taskId);
  const { project } = await assertProjectAccess(userId, task.projectId);

  if (comment.parentCommentId) {
    throw new ValidationError('Only a root comment (discussion) can be reopened');
  }
  if (!comment.resolved) return comment;

  const updated = await prisma.comment.update({
    where: { id: commentId },
    data: { resolved: false, resolvedById: null, resolvedAt: null },
    include: COMMENT_INCLUDE,
  });

  await logActivity({
    workspaceId: project.workspaceId,
    projectId: task.projectId,
    taskId: task.id,
    userId,
    action: 'DISCUSSION_REOPENED',
    metadata: { commentId },
    entityType: 'COMMENT',
    entityId: commentId,
    entityLabel: task.title,
  });

  emitToProject(task.projectId, 'comment.updated', { comment: updated, taskId: task.id, actorId: userId });
  return updated;
}
