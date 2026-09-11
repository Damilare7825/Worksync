-- AlterTable
ALTER TABLE "sessions" ADD COLUMN "refreshTokenHash" TEXT;
ALTER TABLE "sessions" ADD COLUMN "revokedAt" TIMESTAMP(3);
ALTER TABLE "sessions" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refreshTokenHash_key" ON "sessions"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "sessions_refreshTokenHash_idx" ON "sessions"("refreshTokenHash");
