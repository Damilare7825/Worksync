-- CreateEnum
CREATE TYPE "TaskDependencyType" AS ENUM ('DEPENDS_ON');
CREATE TYPE "RecurrencePattern" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- AlterEnum: watcher notifications need a distinct, generic "task changed" type
ALTER TYPE "NotificationType" ADD VALUE 'TASK_UPDATE';

-- AlterTable: subtasks (self-relation) + recurrence-generation pointer
ALTER TABLE "tasks"
  ADD COLUMN     "parentTaskId" TEXT,
  ADD COLUMN     "generatedFromRuleId" TEXT;

CREATE INDEX "tasks_parentTaskId_idx" ON "tasks"("parentTaskId");

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parentTaskId_fkey"
  FOREIGN KEY ("parentTaskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: task_dependencies
CREATE TABLE "task_dependencies" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "dependsOnTaskId" TEXT NOT NULL,
    "type" "TaskDependencyType" NOT NULL DEFAULT 'DEPENDS_ON',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_dependencies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "task_dependencies_taskId_dependsOnTaskId_key" ON "task_dependencies"("taskId", "dependsOnTaskId");
CREATE INDEX "task_dependencies_dependsOnTaskId_idx" ON "task_dependencies"("dependsOnTaskId");

ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_dependsOnTaskId_fkey"
  FOREIGN KEY ("dependsOnTaskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: checklist_items
CREATE TABLE "checklist_items" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checklist_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "checklist_items_taskId_idx" ON "checklist_items"("taskId");

ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: labels
CREATE TABLE "labels" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366F1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "labels_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "labels_workspaceId_name_key" ON "labels"("workspaceId", "name");
CREATE INDEX "labels_workspaceId_idx" ON "labels"("workspaceId");

ALTER TABLE "labels" ADD CONSTRAINT "labels_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: task_labels
CREATE TABLE "task_labels" (
    "taskId" TEXT NOT NULL,
    "labelId" TEXT NOT NULL,

    CONSTRAINT "task_labels_pkey" PRIMARY KEY ("taskId", "labelId")
);

CREATE INDEX "task_labels_labelId_idx" ON "task_labels"("labelId");

ALTER TABLE "task_labels" ADD CONSTRAINT "task_labels_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_labels" ADD CONSTRAINT "task_labels_labelId_fkey"
  FOREIGN KEY ("labelId") REFERENCES "labels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: task_watchers
CREATE TABLE "task_watchers" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_watchers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "task_watchers_taskId_userId_key" ON "task_watchers"("taskId", "userId");
CREATE INDEX "task_watchers_userId_idx" ON "task_watchers"("userId");

ALTER TABLE "task_watchers" ADD CONSTRAINT "task_watchers_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_watchers" ADD CONSTRAINT "task_watchers_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: recurrence_rules
CREATE TABLE "recurrence_rules" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "pattern" "RecurrencePattern" NOT NULL,
    "interval" INTEGER NOT NULL DEFAULT 1,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurrence_rules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "recurrence_rules_taskId_key" ON "recurrence_rules"("taskId");
CREATE INDEX "recurrence_rules_active_nextRunAt_idx" ON "recurrence_rules"("active", "nextRunAt");

ALTER TABLE "recurrence_rules" ADD CONSTRAINT "recurrence_rules_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_generatedFromRuleId_fkey"
  FOREIGN KEY ("generatedFromRuleId") REFERENCES "recurrence_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
