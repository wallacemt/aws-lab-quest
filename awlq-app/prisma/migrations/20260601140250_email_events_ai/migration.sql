-- CreateTable
CREATE TABLE "user_email_event" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "triggerCode" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_email_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_behavior_profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "avgAccessHour" INTEGER,
    "typicalSessionDays" JSONB,
    "churnRiskScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "streakDays" INTEGER NOT NULL DEFAULT 0,
    "lastEmailSentAt" TIMESTAMP(3),
    "lastAnalyzedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_behavior_profile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_email_event_userId_sentAt_idx" ON "user_email_event"("userId", "sentAt");

-- CreateIndex
CREATE INDEX "user_email_event_userId_triggerCode_sentAt_idx" ON "user_email_event"("userId", "triggerCode", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_behavior_profile_userId_key" ON "user_behavior_profile"("userId");

-- AddForeignKey
ALTER TABLE "user_email_event" ADD CONSTRAINT "user_email_event_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_behavior_profile" ADD CONSTRAINT "user_behavior_profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
