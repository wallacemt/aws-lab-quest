/*
  Warnings:

  - A unique constraint covering the columns `[userId,templateId]` on the table `Flashcard` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Flashcard_userId_templateId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "Flashcard_userId_templateId_key" ON "Flashcard"("userId", "templateId");
