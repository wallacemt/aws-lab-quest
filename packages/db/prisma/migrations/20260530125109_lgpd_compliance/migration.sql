-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "leaderboardVisible" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "emailNotifications" BOOLEAN NOT NULL DEFAULT true;
