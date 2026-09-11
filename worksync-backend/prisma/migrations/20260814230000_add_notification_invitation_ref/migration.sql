-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "invitationId" TEXT;

-- CreateIndex
CREATE INDEX "notifications_invitationId_idx" ON "notifications"("invitationId");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "invitations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
