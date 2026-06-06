-- AlterTable
ALTER TABLE "StudyQuestion" ADD COLUMN     "sourceUploadedFileId" TEXT;

-- CreateIndex
CREATE INDEX "StudyQuestion_sourceUploadedFileId_idx" ON "StudyQuestion"("sourceUploadedFileId");

-- AddForeignKey
ALTER TABLE "StudyQuestion" ADD CONSTRAINT "StudyQuestion_sourceUploadedFileId_fkey" FOREIGN KEY ("sourceUploadedFileId") REFERENCES "AdminUploadedFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
