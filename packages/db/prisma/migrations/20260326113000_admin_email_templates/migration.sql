-- CreateTable
CREATE TABLE "AdminEmailTemplate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "subject" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "text" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminEmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminEmailTemplate_code_key" ON "AdminEmailTemplate"("code");

-- CreateIndex
CREATE INDEX "AdminEmailTemplate_active_updatedAt_idx" ON "AdminEmailTemplate"("active", "updatedAt");

-- CreateIndex
CREATE INDEX "AdminEmailTemplate_isSystem_updatedAt_idx" ON "AdminEmailTemplate"("isSystem", "updatedAt");
