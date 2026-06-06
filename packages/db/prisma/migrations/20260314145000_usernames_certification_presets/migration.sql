-- AlterTable
ALTER TABLE "user"
ADD COLUMN "username" TEXT,
ADD COLUMN "role" TEXT NOT NULL DEFAULT 'user',
ADD COLUMN "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "CertificationPreset" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "examMinutes" INTEGER NOT NULL DEFAULT 90,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CertificationPreset_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "UserProfile"
ADD COLUMN "certificationPresetId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "user_username_key" ON "user"("username");

-- CreateIndex
CREATE UNIQUE INDEX "CertificationPreset_code_key" ON "CertificationPreset"("code");

-- AddForeignKey
ALTER TABLE "UserProfile"
ADD CONSTRAINT "UserProfile_certificationPresetId_fkey"
FOREIGN KEY ("certificationPresetId") REFERENCES "CertificationPreset"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
