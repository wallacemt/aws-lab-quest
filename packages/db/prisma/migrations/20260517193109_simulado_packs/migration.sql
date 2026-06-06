-- AlterTable
ALTER TABLE "StudySessionHistory" ADD COLUMN     "packId" TEXT;

-- CreateTable
CREATE TABLE "SimuladoPack" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "certificationPresetId" TEXT,
    "createdByUserId" TEXT,
    "questionCount" INTEGER NOT NULL DEFAULT 65,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SimuladoPack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimuladoPackQuestion" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "SimuladoPackQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SimuladoPack_certificationPresetId_active_idx" ON "SimuladoPack"("certificationPresetId", "active");

-- CreateIndex
CREATE INDEX "SimuladoPack_createdByUserId_idx" ON "SimuladoPack"("createdByUserId");

-- CreateIndex
CREATE INDEX "SimuladoPack_active_createdAt_idx" ON "SimuladoPack"("active", "createdAt");

-- CreateIndex
CREATE INDEX "SimuladoPackQuestion_questionId_idx" ON "SimuladoPackQuestion"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "SimuladoPackQuestion_packId_questionId_key" ON "SimuladoPackQuestion"("packId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "SimuladoPackQuestion_packId_position_key" ON "SimuladoPackQuestion"("packId", "position");

-- CreateIndex
CREATE INDEX "StudySessionHistory_packId_idx" ON "StudySessionHistory"("packId");

-- AddForeignKey
ALTER TABLE "StudySessionHistory" ADD CONSTRAINT "StudySessionHistory_packId_fkey" FOREIGN KEY ("packId") REFERENCES "SimuladoPack"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimuladoPack" ADD CONSTRAINT "SimuladoPack_certificationPresetId_fkey" FOREIGN KEY ("certificationPresetId") REFERENCES "CertificationPreset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimuladoPack" ADD CONSTRAINT "SimuladoPack_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimuladoPackQuestion" ADD CONSTRAINT "SimuladoPackQuestion_packId_fkey" FOREIGN KEY ("packId") REFERENCES "SimuladoPack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimuladoPackQuestion" ADD CONSTRAINT "SimuladoPackQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "StudyQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
