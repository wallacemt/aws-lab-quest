-- AlterTable
ALTER TABLE "WeeklyChallenge" ADD COLUMN     "title" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyChallenge_weekStart_key" ON "WeeklyChallenge"("weekStart");
