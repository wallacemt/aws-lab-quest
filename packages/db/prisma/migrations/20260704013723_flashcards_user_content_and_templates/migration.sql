-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FlashcardSource" ADD VALUE 'USER_CREATED';
ALTER TYPE "FlashcardSource" ADD VALUE 'DEFAULT_DECK';

-- AlterTable
ALTER TABLE "Flashcard" ADD COLUMN     "templateId" TEXT;

-- CreateTable
CREATE TABLE "FlashcardTemplate" (
    "id" TEXT NOT NULL,
    "awsServiceId" TEXT NOT NULL,
    "topic" TEXT,
    "front" TEXT NOT NULL,
    "back" TEXT NOT NULL,
    "hint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlashcardTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FlashcardTemplate_awsServiceId_idx" ON "FlashcardTemplate"("awsServiceId");

-- CreateIndex
CREATE INDEX "Flashcard_userId_templateId_idx" ON "Flashcard"("userId", "templateId");

-- AddForeignKey
ALTER TABLE "Flashcard" ADD CONSTRAINT "Flashcard_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "FlashcardTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlashcardTemplate" ADD CONSTRAINT "FlashcardTemplate_awsServiceId_fkey" FOREIGN KEY ("awsServiceId") REFERENCES "AwsService"("id") ON DELETE CASCADE ON UPDATE CASCADE;
