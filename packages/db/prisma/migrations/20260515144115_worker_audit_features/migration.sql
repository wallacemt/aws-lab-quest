-- AlterTable
ALTER TABLE "WorkerTrigger" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'manual';

-- CreateTable
CREATE TABLE "ScheduledJob" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "queue" TEXT NOT NULL,
    "cronPattern" TEXT NOT NULL,
    "payload" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemConfig" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScheduledJob_jobId_key" ON "ScheduledJob"("jobId");

-- CreateIndex
CREATE INDEX "ScheduledJob_active_idx" ON "ScheduledJob"("active");

-- CreateIndex
CREATE INDEX "WorkerTrigger_source_createdAt_idx" ON "WorkerTrigger"("source", "createdAt");
