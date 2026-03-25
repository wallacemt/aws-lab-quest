-- CreateEnum
CREATE TYPE "StudyQuestionType" AS ENUM ('single', 'multi');

-- AlterTable
ALTER TABLE "StudyQuestion"
ADD COLUMN "questionType" "StudyQuestionType" NOT NULL DEFAULT 'single',
ADD COLUMN "correctOptions" JSONB;

-- Backfill legacy single-choice rows
UPDATE "StudyQuestion"
SET "correctOptions" = jsonb_build_array("correctOption")
WHERE "correctOptions" IS NULL
  AND COALESCE("correctOption", '') <> '';

-- CreateIndex
CREATE INDEX "StudyQuestion_questionType_active_idx" ON "StudyQuestion"("questionType", "active");
