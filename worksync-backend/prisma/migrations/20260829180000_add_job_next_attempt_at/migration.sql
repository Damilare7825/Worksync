-- AlterTable
ALTER TABLE "jobs" ADD COLUMN "nextAttemptAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "jobs_nextAttemptAt_idx" ON "jobs"("nextAttemptAt");
