-- CreateTable
CREATE TABLE "LibraryAccessLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "accessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LibraryAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LibraryAccessLog_userId_accessedAt_idx" ON "LibraryAccessLog"("userId", "accessedAt");

-- CreateIndex
CREATE INDEX "LibraryAccessLog_contentId_idx" ON "LibraryAccessLog"("contentId");

-- AddForeignKey
ALTER TABLE "LibraryAccessLog" ADD CONSTRAINT "LibraryAccessLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryAccessLog" ADD CONSTRAINT "LibraryAccessLog_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "LibraryContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
