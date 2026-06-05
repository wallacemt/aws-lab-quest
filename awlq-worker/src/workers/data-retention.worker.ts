import { Worker, Job } from "bullmq";
import { redis } from "../queues/index.js";
import { prisma } from "../prisma.js";
import { logger } from "../shared/logger.js";
import { randomUUID } from "crypto";

// Days before anonymization kicks in for each account state
const REJECTED_RETENTION_DAYS = 90;
const PENDING_RETENTION_DAYS = 180;
const STUDY_HISTORY_RETENTION_YEARS = 3;

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function yearsAgo(years: number): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d;
}

async function anonymizeUser(userId: string, reason: string): Promise<void> {
  const deletedEmail = `${randomUUID()}@deleted.invalid`;
  const deletedUsername = randomUUID();

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        name: "Usuário Removido",
        email: deletedEmail,
        username: deletedUsername,
        active: false,
      },
    }),
    prisma.userProfile.deleteMany({ where: { userId } }),
    prisma.session.deleteMany({ where: { userId } }),
    prisma.account.deleteMany({ where: { userId } }),
    // LGPD F-01: explicitly delete Phase 1–4 user data tables.
    // The User row is updated (not hard-deleted) so onDelete: Cascade does not
    // fire. These deletes ensure all personal data is removed as required by
    // LGPD Art. 18 right-to-erasure obligations.
    prisma.flashcard.deleteMany({ where: { userId } }),
    // FlashcardReview rows cascade from Flashcard deletion above.
    prisma.falseBeliefSignal.deleteMany({ where: { userId } }),
    prisma.mentorRecommendation.deleteMany({ where: { userId } }),
    prisma.bossBattle.deleteMany({ where: { userId } }),
    prisma.weeklyChallengeEntry.deleteMany({ where: { userId } }),
    prisma.dailyQuizAttempt.deleteMany({ where: { userId } }),
    prisma.userBehaviorProfile.deleteMany({ where: { userId } }),
    prisma.questChainProgress.deleteMany({ where: { userId } }),
  ]);

  logger.info({ userId, reason }, "data-retention: user anonymized");
}

async function anonymizeExpiredSessions(cutoff: Date): Promise<number> {
  // Mark sessions older than the retention window as anonymized.
  // We cannot null the userId FK, so we set the `anonymized` flag instead.
  // All user-facing queries must filter on `anonymized: false` to avoid
  // surfacing these records.
  const { count } = await prisma.studySessionHistory.updateMany({
    where: { createdAt: { lt: cutoff }, anonymized: false },
    data: { anonymized: true },
  });

  return count;
}

async function runRetention(): Promise<void> {
  const rejectedCutoff = daysAgo(REJECTED_RETENTION_DAYS);
  const pendingCutoff = daysAgo(PENDING_RETENTION_DAYS);
  const sessionCutoff = yearsAgo(STUDY_HISTORY_RETENTION_YEARS);

  // Anonymize rejected accounts older than 90 days
  const rejectedUsers = await prisma.user.findMany({
    where: {
      accessStatus: "rejected",
      accessDecisionAt: { lt: rejectedCutoff },
      active: true,
    },
    select: { id: true },
  });

  for (const user of rejectedUsers) {
    await anonymizeUser(user.id, `rejected account older than ${REJECTED_RETENTION_DAYS} days`);
  }

  if (rejectedUsers.length > 0) {
    logger.info({ count: rejectedUsers.length }, "data-retention: anonymized rejected accounts");
  }

  // Anonymize pending accounts older than 180 days
  const pendingUsers = await prisma.user.findMany({
    where: {
      accessStatus: "pending",
      createdAt: { lt: pendingCutoff },
      active: true,
    },
    select: { id: true },
  });

  for (const user of pendingUsers) {
    await anonymizeUser(user.id, `pending account older than ${PENDING_RETENTION_DAYS} days`);
  }

  if (pendingUsers.length > 0) {
    logger.info({ count: pendingUsers.length }, "data-retention: anonymized pending accounts");
  }

  // Anonymize study session history older than 3 years
  const sessionCount = await anonymizeExpiredSessions(sessionCutoff);
  if (sessionCount > 0) {
    logger.info({ count: sessionCount }, "data-retention: anonymized old study session user references");
  }

  logger.info(
    {
      rejectedAnonymized: rejectedUsers.length,
      pendingAnonymized: pendingUsers.length,
      sessionsAnonymized: sessionCount,
    },
    "data-retention: run complete",
  );
}

export function createDataRetentionWorker(): Worker {
  return new Worker<Record<string, never>>(
    "data-retention",
    async (_job: Job) => {
      logger.info("data-retention: starting run");
      await runRetention();
    },
    {
      connection: redis,
      concurrency: 1,
    },
  );
}
