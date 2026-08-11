-- CreateEnum
CREATE TYPE "CertificationJourneyStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- AlterTable
ALTER TABLE "QuestHistory" ADD COLUMN     "journeyId" TEXT;

-- AlterTable
ALTER TABLE "StudySessionHistory" ADD COLUMN     "journeyId" TEXT;

-- CreateTable
CREATE TABLE "CertificationJourney" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "certificationPresetId" TEXT,
    "certificationLabel" TEXT NOT NULL DEFAULT '',
    "status" "CertificationJourneyStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CertificationJourney_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CertificationJourney_userId_status_idx" ON "CertificationJourney"("userId", "status");

-- CreateIndex
CREATE INDEX "CertificationJourney_certificationPresetId_idx" ON "CertificationJourney"("certificationPresetId");

-- CreateIndex
CREATE INDEX "QuestHistory_journeyId_idx" ON "QuestHistory"("journeyId");

-- CreateIndex
CREATE INDEX "StudySessionHistory_journeyId_idx" ON "StudySessionHistory"("journeyId");

-- AddForeignKey
ALTER TABLE "CertificationJourney" ADD CONSTRAINT "CertificationJourney_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificationJourney" ADD CONSTRAINT "CertificationJourney_certificationPresetId_fkey" FOREIGN KEY ("certificationPresetId") REFERENCES "CertificationPreset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudySessionHistory" ADD CONSTRAINT "StudySessionHistory_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "CertificationJourney"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestHistory" ADD CONSTRAINT "QuestHistory_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "CertificationJourney"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: give every existing user one retroactive ACTIVE journey (their
-- current UserProfile certification) and attach their pre-existing history to it,
-- so "Jornadas de Certificação" ships without losing anyone's progress.
INSERT INTO "CertificationJourney" (id, "userId", "certificationPresetId", "certificationLabel", status, "startedAt", "createdAt", "updatedAt")
SELECT
  md5(random()::text || clock_timestamp()::text || up."userId"),
  up."userId",
  up."certificationPresetId",
  up.certification,
  'ACTIVE',
  COALESCE(
    (SELECT MIN(sh."completedAt") FROM "StudySessionHistory" sh WHERE sh."userId" = up."userId"),
    (SELECT MIN(qh."completedAt") FROM "QuestHistory" qh WHERE qh."userId" = up."userId"),
    u."createdAt"
  ),
  now(),
  now()
FROM "UserProfile" up
JOIN "user" u ON u.id = up."userId";

UPDATE "StudySessionHistory" sh
SET "journeyId" = cj.id
FROM "CertificationJourney" cj
WHERE cj."userId" = sh."userId" AND sh."journeyId" IS NULL;

UPDATE "QuestHistory" qh
SET "journeyId" = cj.id
FROM "CertificationJourney" cj
WHERE cj."userId" = qh."userId" AND qh."journeyId" IS NULL;
