-- CreateEnum
CREATE TYPE "UserAccessStatus" AS ENUM ('pending', 'approved', 'rejected');

-- AlterTable
ALTER TABLE "user"
ADD COLUMN "accessStatus" "UserAccessStatus" NOT NULL DEFAULT 'pending',
ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "accessDecisionAt" TIMESTAMP(3),
ADD COLUMN "accessDecisionReason" TEXT;

-- Backfill existing users as approved
UPDATE "user"
SET "accessStatus" = 'approved',
    "accessDecisionAt" = NOW()
WHERE "accessStatus" = 'pending';

-- CreateIndex
CREATE INDEX "user_accessStatus_active_idx" ON "user"("accessStatus", "active");
