-- AlterTable
ALTER TABLE "SimuladoPack" ADD COLUMN "difficultyScore" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "SimuladoPack" ADD COLUMN "journeyNarrative" JSONB;
