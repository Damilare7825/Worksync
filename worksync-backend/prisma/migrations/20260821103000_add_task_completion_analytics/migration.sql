ALTER TABLE "tasks" ADD COLUMN "completedAt" TIMESTAMP(3);

CREATE INDEX "tasks_completedAt_idx" ON "tasks"("completedAt");
CREATE INDEX "tasks_projectId_status_dueDate_idx" ON "tasks"("projectId", "status", "dueDate");
