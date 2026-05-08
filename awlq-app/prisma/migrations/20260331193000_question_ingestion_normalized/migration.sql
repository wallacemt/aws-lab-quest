-- Add normalized ingestion fields
ALTER TABLE "StudyQuestion"
  ADD COLUMN IF NOT EXISTS "rawText" TEXT,
  ADD COLUMN IF NOT EXISTS "ingestionVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "usageHash" TEXT;

-- Topic dictionary
CREATE TABLE IF NOT EXISTS "Topic" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Topic_name_key" ON "Topic"("name");

-- Question options (normalized alternatives)
CREATE TABLE IF NOT EXISTS "QuestionOption" (
  "id" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "isCorrect" BOOLEAN NOT NULL DEFAULT false,
  "order" INTEGER NOT NULL,
  "explanation" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "QuestionOption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "QuestionOption_questionId_order_key" ON "QuestionOption"("questionId", "order");
CREATE INDEX IF NOT EXISTS "QuestionOption_questionId_isCorrect_idx" ON "QuestionOption"("questionId", "isCorrect");

-- N:N Question <-> AWS Services
CREATE TABLE IF NOT EXISTS "QuestionAwsService" (
  "questionId" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuestionAwsService_pkey" PRIMARY KEY ("questionId", "serviceId")
);

CREATE INDEX IF NOT EXISTS "QuestionAwsService_serviceId_idx" ON "QuestionAwsService"("serviceId");

-- N:N Question <-> Topics
CREATE TABLE IF NOT EXISTS "QuestionTopic" (
  "questionId" TEXT NOT NULL,
  "topicId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuestionTopic_pkey" PRIMARY KEY ("questionId", "topicId")
);

CREATE INDEX IF NOT EXISTS "QuestionTopic_topicId_idx" ON "QuestionTopic"("topicId");

-- Unique hash dedupe key
CREATE UNIQUE INDEX IF NOT EXISTS "StudyQuestion_usageHash_key" ON "StudyQuestion"("usageHash");
CREATE INDEX IF NOT EXISTS "StudyQuestion_usageHash_idx" ON "StudyQuestion"("usageHash");

-- Foreign keys
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'QuestionOption_questionId_fkey'
  ) THEN
    ALTER TABLE "QuestionOption"
      ADD CONSTRAINT "QuestionOption_questionId_fkey"
      FOREIGN KEY ("questionId") REFERENCES "StudyQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'QuestionAwsService_questionId_fkey'
  ) THEN
    ALTER TABLE "QuestionAwsService"
      ADD CONSTRAINT "QuestionAwsService_questionId_fkey"
      FOREIGN KEY ("questionId") REFERENCES "StudyQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'QuestionAwsService_serviceId_fkey'
  ) THEN
    ALTER TABLE "QuestionAwsService"
      ADD CONSTRAINT "QuestionAwsService_serviceId_fkey"
      FOREIGN KEY ("serviceId") REFERENCES "AwsService"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'QuestionTopic_questionId_fkey'
  ) THEN
    ALTER TABLE "QuestionTopic"
      ADD CONSTRAINT "QuestionTopic_questionId_fkey"
      FOREIGN KEY ("questionId") REFERENCES "StudyQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'QuestionTopic_topicId_fkey'
  ) THEN
    ALTER TABLE "QuestionTopic"
      ADD CONSTRAINT "QuestionTopic_topicId_fkey"
      FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
