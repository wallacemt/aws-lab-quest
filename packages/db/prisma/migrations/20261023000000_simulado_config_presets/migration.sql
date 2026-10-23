CREATE TYPE "SimuladoExamStyle" AS ENUM ('EXAM', 'EXPLAIN_EACH');
CREATE TYPE "SimuladoTimerMode" AS ENUM ('COUNTDOWN_LOCK', 'COUNTUP_FREE', 'NONE');

CREATE TABLE "SimuladoConfigPreset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "examStyle" "SimuladoExamStyle" NOT NULL DEFAULT 'EXAM',
    "timerMode" "SimuladoTimerMode" NOT NULL DEFAULT 'COUNTDOWN_LOCK',
    "timerMinutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SimuladoConfigPreset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SimuladoConfigPreset_userId_createdAt_idx" ON "SimuladoConfigPreset"("userId", "createdAt");
ALTER TABLE "SimuladoConfigPreset" ADD CONSTRAINT "SimuladoConfigPreset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
