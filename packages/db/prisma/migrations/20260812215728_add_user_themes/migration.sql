-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "customColors" JSONB;

-- CreateTable
CREATE TABLE "UserTheme" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "colors" JSONB NOT NULL,
    "bgImageUrl" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserTheme_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserTheme_userId_idx" ON "UserTheme"("userId");

-- CreateIndex
CREATE INDEX "UserTheme_isPublic_idx" ON "UserTheme"("isPublic");

-- AddForeignKey
ALTER TABLE "UserTheme" ADD CONSTRAINT "UserTheme_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
