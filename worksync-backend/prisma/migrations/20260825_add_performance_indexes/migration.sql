-- Create indexes for performance optimization

-- Task indexes
CREATE INDEX "tasks_createdAt_idx" ON "tasks"("createdAt");
CREATE INDEX "tasks_dueDate_idx" ON "tasks"("dueDate");
CREATE INDEX "tasks_priority_idx" ON "tasks"("priority");

-- Notification indexes
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt");
CREATE INDEX "notifications_userId_read_createdAt_idx" ON "notifications"("userId", "read", "createdAt");

-- Invitation indexes
CREATE INDEX "invitations_workspaceId_idx" ON "invitations"("workspaceId");
CREATE INDEX "invitations_status_idx" ON "invitations"("status");
CREATE INDEX "invitations_expiresAt_idx" ON "invitations"("expiresAt");

-- Comment indexes
CREATE INDEX "comments_createdAt_idx" ON "comments"("createdAt");

-- Attachment indexes
CREATE INDEX "attachments_createdAt_idx" ON "attachments"("createdAt");