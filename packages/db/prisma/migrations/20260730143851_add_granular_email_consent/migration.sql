-- AlterTable
ALTER TABLE "UserProfile" ALTER COLUMN "avatarUrl" SET DEFAULT 'https://djitwkagdqgbhanenonk.supabase.co/storage/v1/object/public/aws-lab-quest/avatars/49f46e8c-1062-4a9d-adbd-f92027e75e31.jpg';

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "notifyEngagementEmails" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notifyFlashcardEmails" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notifyProductUpdateEmails" BOOLEAN NOT NULL DEFAULT false;
