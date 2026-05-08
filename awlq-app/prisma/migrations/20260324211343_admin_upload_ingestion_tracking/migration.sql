-- CreateEnum
CREATE TYPE "AdminUploadType" AS ENUM ('EXAM_GUIDE', 'SIMULADO_PDF', 'SIMULADO_GENERATION');

-- CreateEnum
CREATE TYPE "AdminIngestionStatus" AS ENUM ('PENDING', 'UPLOADING', 'EXTRACTING', 'GENERATING', 'SAVING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "AdminUploadedFile" (
    "id" TEXT NOT NULL,
    "uploadType" "AdminUploadType" NOT NULL,
    "certificationPresetId" TEXT,
    "uploadedByUserId" TEXT,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "storageBucket" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'admin',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUploadedFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminIngestionJob" (
    "id" TEXT NOT NULL,
    "status" "AdminIngestionStatus" NOT NULL DEFAULT 'PENDING',
    "uploadType" "AdminUploadType" NOT NULL,
    "certificationPresetId" TEXT,
    "createdByUserId" TEXT,
    "uploadedFileId" TEXT,
    "fileName" TEXT,
    "progressPercent" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "desiredCount" INTEGER,
    "generatedCount" INTEGER,
    "savedCount" INTEGER,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminIngestionJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminUploadedFile_uploadType_createdAt_idx" ON "AdminUploadedFile"("uploadType", "createdAt");

-- CreateIndex
CREATE INDEX "AdminUploadedFile_certificationPresetId_uploadType_createdA_idx" ON "AdminUploadedFile"("certificationPresetId", "uploadType", "createdAt");

-- CreateIndex
CREATE INDEX "AdminUploadedFile_uploadedByUserId_createdAt_idx" ON "AdminUploadedFile"("uploadedByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminUploadedFile_sha256_idx" ON "AdminUploadedFile"("sha256");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUploadedFile_storageBucket_storagePath_key" ON "AdminUploadedFile"("storageBucket", "storagePath");

-- CreateIndex
CREATE INDEX "AdminIngestionJob_status_createdAt_idx" ON "AdminIngestionJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AdminIngestionJob_uploadType_createdAt_idx" ON "AdminIngestionJob"("uploadType", "createdAt");

-- CreateIndex
CREATE INDEX "AdminIngestionJob_certificationPresetId_createdAt_idx" ON "AdminIngestionJob"("certificationPresetId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminIngestionJob_createdByUserId_createdAt_idx" ON "AdminIngestionJob"("createdByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminIngestionJob_uploadedFileId_idx" ON "AdminIngestionJob"("uploadedFileId");

-- AddForeignKey
ALTER TABLE "AdminUploadedFile" ADD CONSTRAINT "AdminUploadedFile_certificationPresetId_fkey" FOREIGN KEY ("certificationPresetId") REFERENCES "CertificationPreset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminUploadedFile" ADD CONSTRAINT "AdminUploadedFile_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminIngestionJob" ADD CONSTRAINT "AdminIngestionJob_certificationPresetId_fkey" FOREIGN KEY ("certificationPresetId") REFERENCES "CertificationPreset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminIngestionJob" ADD CONSTRAINT "AdminIngestionJob_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminIngestionJob" ADD CONSTRAINT "AdminIngestionJob_uploadedFileId_fkey" FOREIGN KEY ("uploadedFileId") REFERENCES "AdminUploadedFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
