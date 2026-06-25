import { Worker } from "bullmq";
import { connection, WeeklyChallengeJobData } from "../queues/index.js";
import { prisma } from "../prisma.js";
import { logger } from "../shared/logger.js";

function startOfWeekUtc(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0 = Sunday
  // Monday = start of week
  const diff = (day === 0 ? -6 : 1 - day);
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function endOfWeekUtc(date: Date): Date {
  const start = startOfWeekUtc(date);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);
  return end;
}

async function openWeeklyChallenge(): Promise<void> {
  const now = new Date();
  const weekStart = startOfWeekUtc(now);
  const weekEnd = endOfWeekUtc(now);

  // DEF-023: Guard against duplicate runs — if a challenge already exists for this
  // week (e.g. cron fired twice or a manual retry), skip creation and return early.
  // weekStart is not unique in the schema so we use findFirst, not findUnique.
  const existing = await prisma.weeklyChallenge.findFirst({
    where: { weekStart },
    select: { id: true },
  });

  if (existing) {
    logger.info({ challengeId: existing.id, weekStart }, "weekly-challenge: challenge already open for this week, skipping");
    return;
  }

  // Deactivate any previous open challenges before opening the new one.
  await prisma.weeklyChallenge.updateMany({
    where: { active: true },
    data: { active: false },
  });

  const challenge = await prisma.weeklyChallenge.create({
    data: { weekStart, weekEnd, active: true },
  });

  logger.info({ challengeId: challenge.id, weekStart, weekEnd }, "weekly-challenge: opened new challenge");
}

async function closeWeeklyChallenge(): Promise<void> {
  const challenge = await prisma.weeklyChallenge.findFirst({
    where: { active: true },
    include: {
      entries: {
        orderBy: [
          { score: "desc" },
          { updatedAt: "asc" },
        ],
      },
    },
  });

  if (!challenge) {
    logger.warn("weekly-challenge: no active challenge to close");
    return;
  }

  // Assign ranks based on position in sorted list (score desc, earliest submission wins ties).
  await prisma.$transaction(
    challenge.entries.map((entry, index) =>
      prisma.weeklyChallengeEntry.update({
        where: { id: entry.id },
        data: { rank: index + 1 },
      }),
    ),
  );

  await prisma.weeklyChallenge.update({
    where: { id: challenge.id },
    data: { active: false },
  });

  logger.info(
    { challengeId: challenge.id, entryCount: challenge.entries.length },
    "weekly-challenge: closed and ranked",
  );
}

export function createWeeklyChallengeWorker(): Worker {
  return new Worker<WeeklyChallengeJobData>(
    "weekly-challenge",
    async (job) => {
      const { mode } = job.data;
      logger.info({ mode }, "weekly-challenge: processing");

      if (mode === "open") {
        await openWeeklyChallenge();
      } else if (mode === "close") {
        await closeWeeklyChallenge();
      } else {
        logger.warn({ mode }, "weekly-challenge: unknown mode, skipping");
      }
    },
    {
      connection,
      concurrency: 1,
    },
  );
}
