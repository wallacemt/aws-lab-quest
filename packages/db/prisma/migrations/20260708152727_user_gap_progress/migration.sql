-- CreateTable
CREATE TABLE "UserGapProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "awsServiceId" TEXT,
    "topic" TEXT NOT NULL,
    "consecutiveCorrect" INTEGER NOT NULL DEFAULT 0,
    "cleared" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserGapProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserGapProgress_userId_cleared_idx" ON "UserGapProgress"("userId", "cleared");

-- CreateIndex
CREATE UNIQUE INDEX "UserGapProgress_userId_awsServiceId_topic_key" ON "UserGapProgress"("userId", "awsServiceId", "topic");

-- AddForeignKey
ALTER TABLE "UserGapProgress" ADD CONSTRAINT "UserGapProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGapProgress" ADD CONSTRAINT "UserGapProgress_awsServiceId_fkey" FOREIGN KEY ("awsServiceId") REFERENCES "AwsService"("id") ON DELETE CASCADE ON UPDATE CASCADE;
