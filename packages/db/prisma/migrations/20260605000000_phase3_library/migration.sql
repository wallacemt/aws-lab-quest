-- CreateEnum
CREATE TYPE "LibraryContentType" AS ENUM ('PDF', 'IMAGE', 'MARKDOWN', 'SLIDES');

-- CreateTable
CREATE TABLE "LibraryContent" (
    "id" TEXT NOT NULL,
    "type" "LibraryContentType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "certificationPresetId" TEXT,
    "awsServiceId" TEXT,
    "questChainId" TEXT,
    "storageBucket" TEXT,
    "storagePath" TEXT,
    "bodyMarkdown" TEXT,
    "authorName" TEXT NOT NULL,
    "authorUrl" TEXT,
    "authorContact" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "accessCount" INTEGER NOT NULL DEFAULT 0,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibraryContent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LibraryContent_published_category_idx" ON "LibraryContent"("published", "category");

-- CreateIndex
CREATE INDEX "LibraryContent_awsServiceId_published_idx" ON "LibraryContent"("awsServiceId", "published");

-- CreateIndex
CREATE INDEX "LibraryContent_questChainId_published_idx" ON "LibraryContent"("questChainId", "published");
