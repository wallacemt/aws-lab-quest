import { prisma } from "../prisma.js";
import { behavioralEmailQueue } from "../queues/index.js";
import { logger } from "../shared/logger.js";

type TriggerCode = "churn_risk" | "streak_milestone" | "score_improvement" | "score_slump";

type AnalysisResult = {
  analyzed: number;
  scheduled: number;
  skipped: number;
};

const MS_PER_DAY = 86_400_000;

/** Returns the mode (most frequent value) from an array of numbers. */
function mode(values: number[]): number | null {
  if (values.length === 0) return null;
  const freq = new Map<number, number>();
  for (const v of values) {
    freq.set(v, (freq.get(v) ?? 0) + 1);
  }
  let maxCount = 0;
  let modeValue = values[0]!;
  for (const [value, count] of freq.entries()) {
    if (count > maxCount) {
      maxCount = count;
      modeValue = value;
    }
  }
  return modeValue;
}

/** Counts consecutive days with at least one session, going backwards from yesterday. */
function computeStreak(sessionDates: Date[], now: Date): number {
  // Collect distinct days with sessions
  const daySet = new Set(sessionDates.map((d) => formatDay(d)));

  let streak = 0;
  // Start from yesterday to allow today's session to be incomplete
  const cursor = new Date(now);
  cursor.setHours(0, 0, 0, 0);
  cursor.setDate(cursor.getDate() - 1);

  while (true) {
    if (daySet.has(formatDay(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

function formatDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function analyzeAndScheduleBehavioralEmails(): Promise<AnalysisResult> {
  // Check feature flag
  const featureFlag = await prisma.systemConfig.findUnique({
    where: { key: "behavioral_email_enabled" },
  });

  if (featureFlag?.value === "false") {
    logger.info("behavior-analyzer: behavioral_email_enabled is false, skipping");
    return { analyzed: 0, scheduled: 0, skipped: 0 };
  }

  const now = new Date();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * MS_PER_DAY);
  const sevenDaysAgo = new Date(now.getTime() - 7 * MS_PER_DAY);
  const threeDaysAgo = new Date(now.getTime() - 3 * MS_PER_DAY);

  const users = await prisma.user.findMany({
    where: {
      accessStatus: "approved",
      active: true,
      emailNotifications: true,
    },
    select: {
      id: true,
      name: true,
      profile: {
        select: {
          certificationPreset: { select: { code: true } },
        },
      },
    },
  });

  let analyzed = 0;
  let scheduled = 0;
  let skipped = 0;

  for (const user of users) {
    analyzed++;

    // Fetch sessions in the last 14 days
    const recentSessions = await prisma.studySessionHistory.findMany({
      where: {
        userId: user.id,
        completedAt: { gte: fourteenDaysAgo },
      },
      orderBy: { completedAt: "desc" },
      select: { completedAt: true, scorePercent: true, gainedXp: true },
    });

    // Skip users with no sessions in the last 14 days — not enough data
    if (recentSessions.length === 0) {
      skipped++;
      continue;
    }

    const daysSinceLastSession = Math.floor(
      (now.getTime() - recentSessions[0]!.completedAt.getTime()) / MS_PER_DAY
    );

    const sessionCountLast7Days = recentSessions.filter(
      (s) => s.completedAt >= sevenDaysAgo
    ).length;

    const sessionDates = recentSessions.map((s) => s.completedAt);
    const streakDays = computeStreak(sessionDates, now);

    const recentScores = recentSessions.slice(0, 3).map((s) => s.scorePercent);

    // Fetch all-time recent sessions for avgAccessHour (up to 50)
    const allSessions = await prisma.studySessionHistory.findMany({
      where: { userId: user.id },
      select: { completedAt: true },
      take: 50,
      orderBy: { completedAt: "desc" },
    });

    const hours = allSessions.map((s) => s.completedAt.getHours());
    const avgAccessHour = mode(hours);

    // Detect trigger — first match wins
    let triggerCode: TriggerCode | null = null;

    if (streakDays === 7) {
      triggerCode = "streak_milestone";
    } else if (sessionCountLast7Days >= 3 && daysSinceLastSession >= 2) {
      triggerCode = "churn_risk";
    } else if (
      recentScores.length >= 3 &&
      recentScores[0]! > recentScores[1]! &&
      recentScores[1]! > recentScores[2]!
    ) {
      triggerCode = "score_improvement";
    } else if (
      recentScores.length >= 3 &&
      recentScores[2]! - recentScores[0]! >= 15
    ) {
      triggerCode = "score_slump";
    }

    if (!triggerCode) {
      skipped++;
      continue;
    }

    // Cooldown check — skip if email sent in last 3 days
    const recentEvent = await prisma.userEmailEvent.findFirst({
      where: { userId: user.id, sentAt: { gte: threeDaysAgo } },
    });

    if (recentEvent) {
      skipped++;
      continue;
    }

    // Calculate send delay to hit the user's preferred access hour
    const targetHour = avgAccessHour ?? 20;
    const todayTarget = new Date(now);
    todayTarget.setHours(targetHour, 0, 0, 0);
    const sendAt = todayTarget > now ? todayTarget : new Date(todayTarget.getTime() + MS_PER_DAY);
    const delayMs = sendAt.getTime() - now.getTime();

    await behavioralEmailQueue.add(
      `send-${user.id}-${triggerCode}`,
      { mode: "send", userId: user.id, triggerCode },
      { delay: delayMs }
    );

    // Upsert behavior profile
    const churnRiskScore = triggerCode === "churn_risk" ? 0.8 : 0.1;

    await prisma.userBehaviorProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        avgAccessHour,
        streakDays,
        churnRiskScore,
        lastAnalyzedAt: now,
      },
      update: {
        avgAccessHour,
        streakDays,
        churnRiskScore,
        lastAnalyzedAt: now,
      },
    });

    scheduled++;
    logger.info({ userId: user.id, triggerCode, delayMs }, "behavior-analyzer: scheduled email");
  }

  return { analyzed, scheduled, skipped };
}
