-- AlterTable
ALTER TABLE "QuestHistory"
ADD COLUMN "taskSnapshot" JSONB,
ADD COLUMN "sourceLabText" TEXT;
