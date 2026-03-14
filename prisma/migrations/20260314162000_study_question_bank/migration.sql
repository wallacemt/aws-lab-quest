-- CreateEnum
CREATE TYPE "StudyQuestionUsage" AS ENUM ('KC', 'SIMULADO', 'BOTH');

-- CreateEnum
CREATE TYPE "StudyQuestionDifficulty" AS ENUM ('easy', 'medium', 'hard');

-- CreateTable
CREATE TABLE "AwsService" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AwsService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyQuestion" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "usage" "StudyQuestionUsage" NOT NULL DEFAULT 'BOTH',
    "difficulty" "StudyQuestionDifficulty" NOT NULL DEFAULT 'medium',
    "topic" TEXT NOT NULL,
    "optionA" TEXT NOT NULL,
    "optionB" TEXT NOT NULL,
    "optionC" TEXT NOT NULL,
    "optionD" TEXT NOT NULL,
    "optionE" TEXT,
    "correctOption" TEXT NOT NULL,
    "explanationA" TEXT,
    "explanationB" TEXT,
    "explanationC" TEXT,
    "explanationD" TEXT,
    "explanationE" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "certificationPresetId" TEXT,
    "awsServiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AwsService_code_key" ON "AwsService"("code");

-- CreateIndex
CREATE UNIQUE INDEX "StudyQuestion_externalId_key" ON "StudyQuestion"("externalId");

-- CreateIndex
CREATE INDEX "StudyQuestion_usage_active_idx" ON "StudyQuestion"("usage", "active");

-- CreateIndex
CREATE INDEX "StudyQuestion_difficulty_active_idx" ON "StudyQuestion"("difficulty", "active");

-- CreateIndex
CREATE INDEX "StudyQuestion_certificationPresetId_idx" ON "StudyQuestion"("certificationPresetId");

-- CreateIndex
CREATE INDEX "StudyQuestion_awsServiceId_idx" ON "StudyQuestion"("awsServiceId");

-- AddForeignKey
ALTER TABLE "StudyQuestion" ADD CONSTRAINT "StudyQuestion_certificationPresetId_fkey" FOREIGN KEY ("certificationPresetId") REFERENCES "CertificationPreset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyQuestion" ADD CONSTRAINT "StudyQuestion_awsServiceId_fkey" FOREIGN KEY ("awsServiceId") REFERENCES "AwsService"("id") ON DELETE SET NULL ON UPDATE CASCADE;
