import { prisma } from "@/lib/prisma";
import { computeAggregates, currentForTrigger, type TriggerParams, type TriggerType } from "@/lib/achievement-triggers";

export type AchievementItem = {
  id: string;
  code: string;
  name: string;
  description: string;
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
  imageUrl?: string | null;
  unlocked: boolean;
  unlockedAt: string | null;
  current: number;
  target: number;
  progressPercent: number;
};

export type AchievementSummary = {
  total: number;
  unlockedCount: number;
  items: AchievementItem[];
};

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

async function getUserEvents(userId: string) {
  // ponytail: 10 parallel queries per sync (up from 3) — each is a simple
  // indexed count/select, fine at today's scale. Revisit (e.g. cache
  // aggregates, compute async off the request path) if sync latency becomes
  // a measured problem under load.
  const [
    questHistory,
    studyHistory,
    certBadgesCount,
    arenaVictoryCount,
    flashcardReviews,
    user,
    gapClearedCount,
    trailStageCount,
    activeChains,
    completedStages,
    libraryAccessCount,
  ] = await Promise.all([
    prisma.questHistory.findMany({
      where: { userId },
      select: { completedAt: true, xp: true },
      orderBy: { completedAt: "asc" },
      take: 2000,
    }),
    prisma.studySessionHistory.findMany({
      where: { userId },
      select: {
        completedAt: true,
        gainedXp: true,
        sessionType: true,
        scorePercent: true,
        title: true,
      },
      orderBy: { completedAt: "asc" },
      take: 2000,
    }),
    prisma.userCertBadge.count({ where: { userId } }),
    prisma.bossBattle.count({ where: { userId, victory: true } }),
    prisma.flashcardReview.findMany({
      where: { flashcard: { userId } },
      select: { reviewedAt: true },
      take: 2000,
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { lastMentorQuestionAt: true } }),
    prisma.userGapProgress.count({ where: { userId, cleared: true } }),
    prisma.questChainProgress.count({ where: { userId, completed: true } }),
    prisma.questChain.findMany({ where: { active: true }, select: { id: true, stages: { select: { id: true } } } }),
    prisma.questChainProgress.findMany({ where: { userId, completed: true }, select: { stageId: true } }),
    prisma.libraryAccessLog.count({ where: { userId } }),
  ]);

  const completedStageIds = new Set(completedStages.map((item) => item.stageId));
  const trailChainCompletedCount = activeChains.filter(
    (chain) => chain.stages.length > 0 && chain.stages.every((stage) => completedStageIds.has(stage.id)),
  ).length;

  return {
    questHistory,
    studyHistory: studyHistory.map((item) => ({
      ...item,
      sessionType: item.sessionType as "KC" | "SIMULADO",
    })),
    certBadgesCount,
    arenaVictoryCount,
    flashcardReviewDates: flashcardReviews.map((item) => item.reviewedAt),
    mentorConsulted: user?.lastMentorQuestionAt != null,
    gapClearedCount,
    trailStageCount,
    trailChainCompletedCount,
    libraryAccessCount,
  };
}

export async function syncUserAchievements(userId: string): Promise<void> {
  const [events, catalog] = await Promise.all([
    getUserEvents(userId),
    prisma.achievement.findMany({
      where: { active: true },
      select: { id: true, target: true, triggerType: true, triggerParams: true },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const aggregates = computeAggregates(events);

  const unlockables = catalog.filter(
    (achievement) =>
      currentForTrigger(
        achievement.triggerType as TriggerType,
        achievement.triggerParams as TriggerParams | null,
        aggregates,
      ) >= achievement.target,
  );
  if (unlockables.length === 0) {
    return;
  }

  await prisma.$transaction(
    unlockables.map((achievement) =>
      prisma.userAchievement.upsert({
        where: {
          userId_achievementId: {
            userId,
            achievementId: achievement.id,
          },
        },
        create: {
          userId,
          achievementId: achievement.id,
          progress: Math.max(
            0,
            currentForTrigger(
              achievement.triggerType as TriggerType,
              achievement.triggerParams as TriggerParams | null,
              aggregates,
            ),
          ),
        },
        update: {
          progress: Math.max(
            0,
            currentForTrigger(
              achievement.triggerType as TriggerType,
              achievement.triggerParams as TriggerParams | null,
              aggregates,
            ),
          ),
        },
      }),
    ),
  );
}

export async function syncAndGetNewAchievements(
  userId: string,
  since: Date,
): Promise<{ code: string; name: string; description: string; rarity: string; imageUrl: string | null }[]> {
  await syncUserAchievements(userId);

  const newlyUnlocked = await prisma.userAchievement.findMany({
    where: { userId, unlockedAt: { gte: since } },
    select: {
      achievement: {
        select: { code: true, name: true, description: true, rarity: true, imageUrl: true },
      },
    },
  });

  return newlyUnlocked.map((ua) => ua.achievement);
}

export async function getUserAchievementSummary(userId: string): Promise<AchievementSummary> {
  await syncUserAchievements(userId);

  const [events, catalog, owned] = await Promise.all([
    getUserEvents(userId),
    prisma.achievement.findMany({
      where: { active: true },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        rarity: true,
        imageUrl: true,
        target: true,
        triggerType: true,
        triggerParams: true,
      },
    }),
    prisma.userAchievement.findMany({
      where: { userId },
      select: {
        achievementId: true,
        unlockedAt: true,
      },
    }),
  ]);

  const aggregates = computeAggregates(events);
  const ownedMap = new Map(owned.map((item) => [item.achievementId, item.unlockedAt]));

  const items: AchievementItem[] = catalog.map((achievement) => {
    const current = currentForTrigger(
      achievement.triggerType as TriggerType,
      achievement.triggerParams as TriggerParams | null,
      aggregates,
    );
    const unlockedAt = ownedMap.get(achievement.id);
    const unlocked = Boolean(unlockedAt) || current >= achievement.target;

    return {
      id: achievement.id,
      code: achievement.code,
      name: achievement.name,
      description: achievement.description,
      rarity: (achievement.rarity as AchievementItem["rarity"]) ?? "common",
      imageUrl: achievement.imageUrl,
      unlocked,
      unlockedAt: unlockedAt ? unlockedAt.toISOString() : null,
      current,
      target: achievement.target,
      progressPercent: clampPercent((current / Math.max(1, achievement.target)) * 100),
    };
  });

  return {
    total: items.length,
    unlockedCount: items.filter((item) => item.unlocked).length,
    items,
  };
}
