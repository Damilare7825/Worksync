-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'REACTION';
ALTER TYPE "NotificationType" ADD VALUE 'DISCUSSION_RESOLVED';

-- AlterTable: threads + resolution on comments
ALTER TABLE "comments"
  ADD COLUMN     "parentCommentId" TEXT,
  ADD COLUMN     "resolved" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN     "resolvedById" TEXT,
  ADD COLUMN     "resolvedAt" TIMESTAMP(3);

CREATE INDEX "comments_parentCommentId_idx" ON "comments"("parentCommentId");

ALTER TABLE "comments" ADD CONSTRAINT "comments_parentCommentId_fkey"
  FOREIGN KEY ("parentCommentId") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comments" ADD CONSTRAINT "comments_resolvedById_fkey"
  FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: comment_mentions
CREATE TABLE "comment_mentions" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comment_mentions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "comment_mentions_commentId_userId_key" ON "comment_mentions"("commentId", "userId");
CREATE INDEX "comment_mentions_userId_idx" ON "comment_mentions"("userId");

ALTER TABLE "comment_mentions" ADD CONSTRAINT "comment_mentions_commentId_fkey"
  FOREIGN KEY ("commentId") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comment_mentions" ADD CONSTRAINT "comment_mentions_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: comment_reactions
CREATE TABLE "comment_reactions" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comment_reactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "comment_reactions_commentId_userId_emoji_key" ON "comment_reactions"("commentId", "userId", "emoji");
CREATE INDEX "comment_reactions_commentId_idx" ON "comment_reactions"("commentId");

ALTER TABLE "comment_reactions" ADD CONSTRAINT "comment_reactions_commentId_fkey"
  FOREIGN KEY ("commentId") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comment_reactions" ADD CONSTRAINT "comment_reactions_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
