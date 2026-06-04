-- Phase 1: Retention Spine (Blueprint-001)
-- Adds: Flashcard, FlashcardReview, FalseBeliefSignal models
--       UserBehaviorProfile.lastStreakDate + dailyFlashcardCap columns
--       UserProfile.targetExamDate column
--       AnswerConfidence, FlashcardSource, FlashcardGrade enums

-- CreateEnum
CREATE TYPE "FlashcardSource" AS ENUM ('WRONG_ANSWER', 'REVIEW_FLAG', 'SLOW_ANSWER', 'AI_EXPLANATION', 'MEMORY_RECOVERY');

-- CreateEnum
CREATE TYPE "FlashcardGrade" AS ENUM ('VERY_HARD', 'HARD', 'GOOD', 'EASY');

-- CreateEnum
CREATE TYPE "AnswerConfidence" AS ENUM ('high', 'medium', 'low');

-- AlterTable: UserProfile — add targetExamDate
ALTER TABLE "UserProfile" ADD COLUMN "targetExamDate" TIMESTAMP(3);

-- AlterTable: user_behavior_profile — add lastStreakDate and dailyFlashcardCap
ALTER TABLE "user_behavior_profile"
  ADD COLUMN "lastStreakDate"    TIMESTAMP(3),
  ADD COLUMN "dailyFlashcardCap" INTEGER NOT NULL DEFAULT 30;

-- CreateTable: Flashcard
CREATE TABLE "Flashcard" (
    "id"               TEXT NOT NULL,
    "userId"           TEXT NOT NULL,
    "sourceQuestionId" TEXT,
    "awsServiceId"     TEXT,
    "topic"            TEXT,
    "front"            TEXT NOT NULL,
    "back"             TEXT NOT NULL,
    "hint"             TEXT,
    "source"           "FlashcardSource" NOT NULL,
    "easeFactor"       DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "intervalDays"     INTEGER NOT NULL DEFAULT 0,
    "repetitions"      INTEGER NOT NULL DEFAULT 0,
    "dueAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReviewedAt"   TIMESTAMP(3),
    "suspended"        BOOLEAN NOT NULL DEFAULT false,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Flashcard_pkey" PRIMARY KEY ("id")
);

-- CreateTable: FlashcardReview
CREATE TABLE "FlashcardReview" (
    "id"          TEXT NOT NULL,
    "flashcardId" TEXT NOT NULL,
    "grade"       "FlashcardGrade" NOT NULL,
    "prevInterval" INTEGER NOT NULL,
    "newInterval"  INTEGER NOT NULL,
    "reviewedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlashcardReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable: FalseBeliefSignal
CREATE TABLE "FalseBeliefSignal" (
    "id"               TEXT NOT NULL,
    "userId"           TEXT NOT NULL,
    "awsServiceId"     TEXT,
    "topic"            TEXT,
    "falseBeliefCount" INTEGER NOT NULL DEFAULT 0,
    "knownGapCount"    INTEGER NOT NULL DEFAULT 0,
    "masteryCount"     INTEGER NOT NULL DEFAULT 0,
    "windowDays"       INTEGER NOT NULL DEFAULT 30,
    "computedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FalseBeliefSignal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex on Flashcard
CREATE INDEX "Flashcard_userId_dueAt_idx" ON "Flashcard"("userId", "dueAt");
CREATE INDEX "Flashcard_userId_suspended_dueAt_idx" ON "Flashcard"("userId", "suspended", "dueAt");
CREATE INDEX "Flashcard_sourceQuestionId_idx" ON "Flashcard"("sourceQuestionId");
CREATE UNIQUE INDEX "Flashcard_userId_sourceQuestionId_source_key" ON "Flashcard"("userId", "sourceQuestionId", "source");

-- CreateIndex on FlashcardReview
CREATE INDEX "FlashcardReview_flashcardId_reviewedAt_idx" ON "FlashcardReview"("flashcardId", "reviewedAt");

-- CreateIndex on FalseBeliefSignal
CREATE UNIQUE INDEX "FalseBeliefSignal_userId_awsServiceId_topic_key" ON "FalseBeliefSignal"("userId", "awsServiceId", "topic");
CREATE INDEX "FalseBeliefSignal_userId_computedAt_idx" ON "FalseBeliefSignal"("userId", "computedAt");

-- AddForeignKey: Flashcard → user
ALTER TABLE "Flashcard" ADD CONSTRAINT "Flashcard_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Flashcard → StudyQuestion (nullable)
ALTER TABLE "Flashcard" ADD CONSTRAINT "Flashcard_sourceQuestionId_fkey"
    FOREIGN KEY ("sourceQuestionId") REFERENCES "StudyQuestion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: FlashcardReview → Flashcard
ALTER TABLE "FlashcardReview" ADD CONSTRAINT "FlashcardReview_flashcardId_fkey"
    FOREIGN KEY ("flashcardId") REFERENCES "Flashcard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
