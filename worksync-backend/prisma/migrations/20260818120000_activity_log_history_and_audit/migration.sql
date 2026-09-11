-- DropForeignKey
-- Switching projectId/taskId from ON DELETE CASCADE to ON DELETE SET NULL so
-- that deleting a Project/Task no longer silently wipes out its own
-- ActivityLog history. entityType/entityId/entityLabel (added below)
-- preserve enough context for the entry to still make sense once the FK
-- is nulled out.
ALTER TABLE "activity_logs" DROP CONSTRAINT IF EXISTS "activity_logs_projectId_fkey";
ALTER TABLE "activity_logs" DROP CONSTRAINT IF EXISTS "activity_logs_taskId_fkey";

-- AlterTable
ALTER TABLE "activity_logs"
  ADD COLUMN     "entityType" TEXT,
  ADD COLUMN     "entityId" TEXT,
  ADD COLUMN     "entityLabel" TEXT,
  ADD COLUMN     "isAudit" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "activity_logs_workspaceId_action_idx" ON "activity_logs"("workspaceId", "action");
CREATE INDEX "activity_logs_workspaceId_userId_idx" ON "activity_logs"("workspaceId", "userId");
CREATE INDEX "activity_logs_workspaceId_createdAt_idx" ON "activity_logs"("workspaceId", "createdAt");
CREATE INDEX "activity_logs_entityType_entityId_idx" ON "activity_logs"("entityType", "entityId");
