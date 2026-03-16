ALTER TABLE "StudyQuestion"
ADD COLUMN "cachedExplainSummary" TEXT,
ADD COLUMN "cachedExplainA" TEXT,
ADD COLUMN "cachedExplainB" TEXT,
ADD COLUMN "cachedExplainC" TEXT,
ADD COLUMN "cachedExplainD" TEXT,
ADD COLUMN "cachedExplainE" TEXT,
ADD COLUMN "cachedExplainAt" TIMESTAMP(3),
ADD COLUMN "cachedExplainVersion" INTEGER NOT NULL DEFAULT 1;

CREATE INDEX "StudyQuestion_cachedExplainAt_idx" ON "StudyQuestion"("cachedExplainAt");
