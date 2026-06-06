-- Phase 2: Mentor + Quest Chains (Blueprint-001)
-- Adds: MentorRecommendation, QuestChain, QuestChainStage, QuestChainProgress models
-- Back-relations on User: mentorRecommendations, questChainProgress

-- CreateTable: MentorRecommendation
CREATE TABLE "MentorRecommendation" (
    "id"            TEXT NOT NULL,
    "userId"        TEXT NOT NULL,
    "rank"          INTEGER NOT NULL,
    "actionType"    TEXT NOT NULL,
    "targetRef"     TEXT,
    "title"         TEXT NOT NULL,
    "rationale"     TEXT NOT NULL,
    "priorityScore" DOUBLE PRECISION NOT NULL,
    "generatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MentorRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex on MentorRecommendation
CREATE INDEX "MentorRecommendation_userId_generatedAt_idx" ON "MentorRecommendation"("userId", "generatedAt");

-- AddForeignKey: MentorRecommendation → user
ALTER TABLE "MentorRecommendation" ADD CONSTRAINT "MentorRecommendation_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: QuestChain
CREATE TABLE "QuestChain" (
    "id"                    TEXT NOT NULL,
    "certificationPresetId" TEXT,
    "name"                  TEXT NOT NULL,
    "description"           TEXT,
    "displayOrder"          INTEGER NOT NULL DEFAULT 0,
    "active"                BOOLEAN NOT NULL DEFAULT true,
    "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestChain_pkey" PRIMARY KEY ("id")
);

-- CreateTable: QuestChainStage
CREATE TABLE "QuestChainStage" (
    "id"           TEXT NOT NULL,
    "chainId"      TEXT NOT NULL,
    "position"     INTEGER NOT NULL,
    "awsServiceId" TEXT,
    "topic"        TEXT,
    "title"        TEXT NOT NULL,
    "unlockRule"   JSONB,

    CONSTRAINT "QuestChainStage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex on QuestChainStage
CREATE UNIQUE INDEX "QuestChainStage_chainId_position_key" ON "QuestChainStage"("chainId", "position");

-- AddForeignKey: QuestChainStage → QuestChain
ALTER TABLE "QuestChainStage" ADD CONSTRAINT "QuestChainStage_chainId_fkey"
    FOREIGN KEY ("chainId") REFERENCES "QuestChain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: QuestChainProgress
CREATE TABLE "QuestChainProgress" (
    "id"          TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "stageId"     TEXT NOT NULL,
    "completed"   BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "QuestChainProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex on QuestChainProgress
CREATE UNIQUE INDEX "QuestChainProgress_userId_stageId_key" ON "QuestChainProgress"("userId", "stageId");
CREATE INDEX "QuestChainProgress_userId_completed_idx" ON "QuestChainProgress"("userId", "completed");

-- AddForeignKey: QuestChainProgress → user
ALTER TABLE "QuestChainProgress" ADD CONSTRAINT "QuestChainProgress_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: QuestChainProgress → QuestChainStage
ALTER TABLE "QuestChainProgress" ADD CONSTRAINT "QuestChainProgress_stageId_fkey"
    FOREIGN KEY ("stageId") REFERENCES "QuestChainStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
