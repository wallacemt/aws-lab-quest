CREATE TABLE "XpWeightConfig" (
    "id" TEXT NOT NULL,
    "activityType" TEXT NOT NULL,
    "topic" TEXT NOT NULL DEFAULT '*',
    "difficulty" TEXT NOT NULL DEFAULT '*',
    "multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "bonusXp" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "XpWeightConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "XpWeightConfig_activityType_topic_difficulty_key" ON "XpWeightConfig"("activityType", "topic", "difficulty");
CREATE INDEX "XpWeightConfig_activityType_active_idx" ON "XpWeightConfig"("activityType", "active");
