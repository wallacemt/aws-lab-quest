-- CreateTable
CREATE TABLE "UserCertBadge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "certificationPresetId" TEXT,
    "badgeUrl" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCertBadge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserCertBadge_userId_idx" ON "UserCertBadge"("userId");

-- AddForeignKey
ALTER TABLE "UserCertBadge" ADD CONSTRAINT "UserCertBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCertBadge" ADD CONSTRAINT "UserCertBadge_certificationPresetId_fkey" FOREIGN KEY ("certificationPresetId") REFERENCES "CertificationPreset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
