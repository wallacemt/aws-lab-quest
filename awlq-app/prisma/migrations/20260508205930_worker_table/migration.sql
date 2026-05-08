-- CreateEnum
CREATE TYPE "IngestionSourceStatus" AS ENUM ('PENDING', 'FETCHING', 'FETCHED', 'FAILED', 'COMPLETED');

-- CreateTable
CREATE TABLE "IngestionSource" (
    "id" TEXT NOT NULL,
    "certificationPresetId" TEXT,
    "url" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "status" "IngestionSourceStatus" NOT NULL DEFAULT 'PENDING',
    "lastFetchedAt" TIMESTAMP(3),
    "lastFetchSha256" TEXT,
    "parsedDomainCount" INTEGER NOT NULL DEFAULT 0,
    "generatedQuestionCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngestionSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamBlueprintDomain" (
    "id" TEXT NOT NULL,
    "certificationPresetId" TEXT NOT NULL,
    "ingestionSourceId" TEXT,
    "domainNumber" INTEGER NOT NULL,
    "domainName" TEXT NOT NULL,
    "weightPercent" DOUBLE PRECISION NOT NULL,
    "subTopics" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamBlueprintDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionPerformance" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "totalAttempts" INTEGER NOT NULL DEFAULT 0,
    "totalCorrect" INTEGER NOT NULL DEFAULT 0,
    "correctRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discriminationIndex" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "lastComputedAt" TIMESTAMP(3),
    "flaggedForReview" BOOLEAN NOT NULL DEFAULT false,
    "flagReason" TEXT,
    "reviewResult" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionPerformance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeakAreaReport" (
    "id" TEXT NOT NULL,
    "certificationPresetId" TEXT NOT NULL,
    "windowDays" INTEGER NOT NULL DEFAULT 30,
    "sessionsAnalyzed" INTEGER NOT NULL DEFAULT 0,
    "weakAreas" JSONB NOT NULL,
    "generationQueued" BOOLEAN NOT NULL DEFAULT false,
    "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeakAreaReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerTrigger" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "certificationPresetId" TEXT,
    "payload" JSONB,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkerTrigger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IngestionSource_url_key" ON "IngestionSource"("url");

-- CreateIndex
CREATE INDEX "IngestionSource_status_active_idx" ON "IngestionSource"("status", "active");

-- CreateIndex
CREATE INDEX "IngestionSource_certificationPresetId_status_idx" ON "IngestionSource"("certificationPresetId", "status");

-- CreateIndex
CREATE INDEX "ExamBlueprintDomain_certificationPresetId_active_idx" ON "ExamBlueprintDomain"("certificationPresetId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "ExamBlueprintDomain_certificationPresetId_domainNumber_key" ON "ExamBlueprintDomain"("certificationPresetId", "domainNumber");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionPerformance_questionId_key" ON "QuestionPerformance"("questionId");

-- CreateIndex
CREATE INDEX "QuestionPerformance_flaggedForReview_lastComputedAt_idx" ON "QuestionPerformance"("flaggedForReview", "lastComputedAt");

-- CreateIndex
CREATE INDEX "QuestionPerformance_correctRate_idx" ON "QuestionPerformance"("correctRate");

-- CreateIndex
CREATE INDEX "WeakAreaReport_certificationPresetId_analyzedAt_idx" ON "WeakAreaReport"("certificationPresetId", "analyzedAt");

-- CreateIndex
CREATE INDEX "WorkerTrigger_processed_createdAt_idx" ON "WorkerTrigger"("processed", "createdAt");

-- AddForeignKey
ALTER TABLE "IngestionSource" ADD CONSTRAINT "IngestionSource_certificationPresetId_fkey" FOREIGN KEY ("certificationPresetId") REFERENCES "CertificationPreset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamBlueprintDomain" ADD CONSTRAINT "ExamBlueprintDomain_certificationPresetId_fkey" FOREIGN KEY ("certificationPresetId") REFERENCES "CertificationPreset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamBlueprintDomain" ADD CONSTRAINT "ExamBlueprintDomain_ingestionSourceId_fkey" FOREIGN KEY ("ingestionSourceId") REFERENCES "IngestionSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionPerformance" ADD CONSTRAINT "QuestionPerformance_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "StudyQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeakAreaReport" ADD CONSTRAINT "WeakAreaReport_certificationPresetId_fkey" FOREIGN KEY ("certificationPresetId") REFERENCES "CertificationPreset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
