-- Phase 19: persist Kanban/list ordering within a project status column.
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "position" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "tasks_projectId_status_position_idx" ON "tasks"("projectId", "status", "position");
