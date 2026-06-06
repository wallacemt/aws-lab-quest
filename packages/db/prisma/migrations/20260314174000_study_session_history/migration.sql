-- CreateEnum
CREATE TYPE "StudySessionType" AS ENUM ('KC', 'SIMULADO');

-- CreateTable
CREATE TABLE "StudySessionHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionType" "StudySessionType" NOT NULL,
    "title" TEXT NOT NULL,
    "certificationCode" TEXT,
    "scorePercent" INTEGER NOT NULL,
    "correctAnswers" INTEGER NOT NULL,
    "totalQuestions" INTEGER NOT NULL,
    "durationSeconds" INTEGER,
    "answersSnapshot" JSONB NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudySessionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudySessionHistory_userId_completedAt_idx" ON "StudySessionHistory"("userId", "completedAt");

-- CreateIndex
CREATE INDEX "StudySessionHistory_sessionType_idx" ON "StudySessionHistory"("sessionType");

-- AddForeignKey
ALTER TABLE "StudySessionHistory" ADD CONSTRAINT "StudySessionHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
