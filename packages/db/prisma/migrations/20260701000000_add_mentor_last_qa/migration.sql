-- Add last question/answer fields so the mentor screen can show the user's most recent Q&A on load.
ALTER TABLE "user" ADD COLUMN "lastMentorQuestion" TEXT;
ALTER TABLE "user" ADD COLUMN "lastMentorAnswer"   TEXT;
