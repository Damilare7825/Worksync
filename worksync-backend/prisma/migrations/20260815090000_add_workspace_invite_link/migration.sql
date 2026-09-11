-- AlterTable
ALTER TABLE "workspaces" ADD COLUMN     "inviteLinkToken" TEXT,
ADD COLUMN     "inviteLinkEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "inviteLinkRole" "WorkspaceRole" NOT NULL DEFAULT 'MEMBER';

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_inviteLinkToken_key" ON "workspaces"("inviteLinkToken");
