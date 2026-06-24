-- CreateTable
CREATE TABLE "TrailStageExplain" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "markdown" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrailStageExplain_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrailStageExplain_stageId_key" ON "TrailStageExplain"("stageId");

-- CreateIndex
CREATE INDEX "TrailStageExplain_stageId_idx" ON "TrailStageExplain"("stageId");

-- AddForeignKey
ALTER TABLE "TrailStageExplain" ADD CONSTRAINT "TrailStageExplain_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "QuestChainStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
