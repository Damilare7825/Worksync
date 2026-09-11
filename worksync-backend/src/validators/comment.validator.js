import { z } from 'zod';

export const createCommentSchema = z.object({
  content: z.string().trim().min(1, 'Comment cannot be empty').max(3000),
  parentCommentId: z.string().uuid('Must be a valid comment ID').optional(),
  mentionedUserIds: z.array(z.string().uuid()).max(50).optional(),
});

export const updateCommentSchema = z.object({
  content: z.string().trim().min(1, 'Comment cannot be empty').max(3000),
  mentionedUserIds: z.array(z.string().uuid()).max(50).optional(),
});

export const reactionSchema = z.object({
  // A conservative allow-list rather than any string keeps this from
  // becoming a place to stash arbitrary text — reactions are a small,
  // known set of emoji, not free-form content.
  emoji: z.enum(['👍', '❤️', '🎉', '👀', '🚀', '😄', '😕']),
});
