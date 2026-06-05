-- Phase 4 Arena: Boss, BossBattle, WeeklyChallenge, WeeklyChallengeEntry, DailyQuiz, DailyQuizAttempt

CREATE TABLE "Boss" (
    "id"               TEXT NOT NULL,
    "name"             TEXT NOT NULL,
    "code"             TEXT NOT NULL,
    "themeService"     TEXT NOT NULL,
    "maxHp"            INTEGER NOT NULL,
    "damagePerCorrect" INTEGER NOT NULL DEFAULT 10,
    "artworkUrl"       TEXT,
    "active"           BOOLEAN NOT NULL DEFAULT true,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Boss_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Boss_code_key" ON "Boss"("code");
CREATE INDEX "Boss_active_idx" ON "Boss"("active");

CREATE TABLE "BossBattle" (
    "id"          TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "bossId"      TEXT NOT NULL,
    "remainingHp" INTEGER NOT NULL,
    "victory"     BOOLEAN NOT NULL DEFAULT false,
    "gainedXp"    INTEGER NOT NULL DEFAULT 0,
    "finishedAt"  TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BossBattle_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BossBattle_userId_bossId_idx" ON "BossBattle"("userId", "bossId");
CREATE INDEX "BossBattle_userId_victory_idx" ON "BossBattle"("userId", "victory");

ALTER TABLE "BossBattle" ADD CONSTRAINT "BossBattle_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BossBattle" ADD CONSTRAINT "BossBattle_bossId_fkey"
    FOREIGN KEY ("bossId") REFERENCES "Boss"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WeeklyChallenge" (
    "id"            TEXT NOT NULL,
    "weekStart"     TIMESTAMP(3) NOT NULL,
    "weekEnd"       TIMESTAMP(3) NOT NULL,
    "active"        BOOLEAN NOT NULL DEFAULT true,
    "badgeImageUrl" TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyChallenge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WeeklyChallenge_active_weekStart_idx" ON "WeeklyChallenge"("active", "weekStart");

CREATE TABLE "WeeklyChallengeEntry" (
    "id"          TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "score"       INTEGER NOT NULL DEFAULT 0,
    "rank"        INTEGER,
    "gainedXp"    INTEGER NOT NULL DEFAULT 0,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyChallengeEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WeeklyChallengeEntry_challengeId_userId_key"
    ON "WeeklyChallengeEntry"("challengeId", "userId");
CREATE INDEX "WeeklyChallengeEntry_challengeId_score_idx"
    ON "WeeklyChallengeEntry"("challengeId", "score");
CREATE INDEX "WeeklyChallengeEntry_userId_idx" ON "WeeklyChallengeEntry"("userId");

ALTER TABLE "WeeklyChallengeEntry" ADD CONSTRAINT "WeeklyChallengeEntry_challengeId_fkey"
    FOREIGN KEY ("challengeId") REFERENCES "WeeklyChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeeklyChallengeEntry" ADD CONSTRAINT "WeeklyChallengeEntry_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DailyQuiz" (
    "id"          TEXT NOT NULL,
    "quizDate"    DATE NOT NULL,
    "questionIds" JSONB NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyQuiz_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DailyQuiz_quizDate_key" ON "DailyQuiz"("quizDate");
CREATE INDEX "DailyQuiz_quizDate_idx" ON "DailyQuiz"("quizDate");

CREATE TABLE "DailyQuizAttempt" (
    "id"          TEXT NOT NULL,
    "quizId"      TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "score"       INTEGER NOT NULL DEFAULT 0,
    "totalCount"  INTEGER NOT NULL DEFAULT 5,
    "gainedXp"    INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyQuizAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DailyQuizAttempt_quizId_userId_key"
    ON "DailyQuizAttempt"("quizId", "userId");
CREATE INDEX "DailyQuizAttempt_userId_completedAt_idx"
    ON "DailyQuizAttempt"("userId", "completedAt");

ALTER TABLE "DailyQuizAttempt" ADD CONSTRAINT "DailyQuizAttempt_quizId_fkey"
    FOREIGN KEY ("quizId") REFERENCES "DailyQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DailyQuizAttempt" ADD CONSTRAINT "DailyQuizAttempt_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
