-- Enums for question reports
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'QuestionReportStatus') THEN
    CREATE TYPE "QuestionReportStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'QuestionReportReason') THEN
    CREATE TYPE "QuestionReportReason" AS ENUM (
      'INCORRECT_ANSWER',
      'UNCLEAR_STATEMENT',
      'MISSING_CONTEXT',
      'GRAMMAR_TYPO',
      'DUPLICATE',
      'QUALITY_ISSUE',
      'OTHER'
    );
  END IF;
END $$;

-- Add flags to StudyQuestion
ALTER TABLE "StudyQuestion"
  ADD COLUMN IF NOT EXISTS "flaggedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "flaggedReason" TEXT;

CREATE INDEX IF NOT EXISTS "StudyQuestion_flaggedAt_idx" ON "StudyQuestion"("flaggedAt");

-- Create report table
CREATE TABLE IF NOT EXISTS "question_report" (
  "id" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "reason" "QuestionReportReason" NOT NULL,
  "description" TEXT,
  "status" "QuestionReportStatus" NOT NULL DEFAULT 'OPEN',
  "reviewedByUserId" TEXT,
  "reviewNotes" TEXT,
  "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "question_report_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "question_report_questionId_status_idx" ON "question_report"("questionId", "status");
CREATE INDEX IF NOT EXISTS "question_report_userId_reportedAt_idx" ON "question_report"("userId", "reportedAt");
CREATE INDEX IF NOT EXISTS "question_report_status_reportedAt_idx" ON "question_report"("status", "reportedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'question_report_questionId_fkey'
  ) THEN
    ALTER TABLE "question_report"
      ADD CONSTRAINT "question_report_questionId_fkey"
      FOREIGN KEY ("questionId") REFERENCES "StudyQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'question_report_userId_fkey'
  ) THEN
    ALTER TABLE "question_report"
      ADD CONSTRAINT "question_report_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'question_report_reviewedByUserId_fkey'
  ) THEN
    ALTER TABLE "question_report"
      ADD CONSTRAINT "question_report_reviewedByUserId_fkey"
      FOREIGN KEY ("reviewedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
