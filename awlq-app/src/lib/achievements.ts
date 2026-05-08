import { prisma } from "@/lib/prisma";
import { ACHIEVEMENT_DEFS } from "@/lib/achievement-catalog";

type QuestEvent = {
  completedAt: Date;
  xp: number;
};

type StudyEvent = {
  completedAt: Date;
  gainedXp: number;
  sessionType: "KC" | "SIMULADO";
  scorePercent: number;
};

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

type MetricMap = Record<string, { current: number; unlocked: boolean }>;

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getConsecutiveDaysMax(dates: Date[]): number {
  if (dates.length === 0) {
    return 0;
  }

  const dayKeys = Array.from(
    new Set(
      dates
        .map((date) => {
          const d = new Date(date);
          d.setHours(0, 0, 0, 0);
          return d.toISOString();
        })
        .sort(),
    ),
  );

  let maxStreak = 1;
  let currentStreak = 1;

  for (let i = 1; i < dayKeys.length; i += 1) {
    const prev = new Date(dayKeys[i - 1]).getTime();
    const curr = new Date(dayKeys[i]).getTime();
    const diffDays = Math.round((curr - prev) / (24 * 60 * 60 * 1000));

    if (diffDays === 1) {
      currentStreak += 1;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 1;
    }
  }

  return maxStreak;
}

function computeMetrics(input: { questHistory: QuestEvent[]; studyHistory: StudyEvent[] }): MetricMap {
  const questHistory = input.questHistory;
  const studyHistory = input.studyHistory;

  const kcSessions = studyHistory.filter((item) => item.sessionType === "KC");
  const simuladoSessions = studyHistory.filter((item) => item.sessionType === "SIMULADO");
  const simuladoPassed = simuladoSessions.filter((item) => item.scorePercent >= 70);

  const totalXp =
    questHistory.reduce((sum, item) => sum + item.xp, 0) + studyHistory.reduce((sum, item) => sum + item.gainedXp, 0);

  const allDates = [...questHistory.map((item) => item.completedAt), ...studyHistory.map((item) => item.completedAt)];
  const maxStreak = getConsecutiveDaysMax(allDates);
  const totalSessions = questHistory.length + studyHistory.length;

  return {
    first_lab: { current: questHistory.length, unlocked: questHistory.length >= 1 },
    lab_master_10: { current: questHistory.length, unlocked: questHistory.length >= 10 },
    lab_master_25: { current: questHistory.length, unlocked: questHistory.length >= 25 },
    perfect_kc: {
      current: kcSessions.some((item) => item.scorePercent === 100) ? 1 : 0,
      unlocked: kcSessions.some((item) => item.scorePercent === 100),
    },
    simulado_aprovado: { current: simuladoPassed.length > 0 ? 1 : 0, unlocked: simuladoPassed.length > 0 },
    simulado_veterano_5: { current: simuladoSessions.length, unlocked: simuladoSessions.length >= 5 },
    knowledge_hunter_10: { current: kcSessions.length, unlocked: kcSessions.length >= 10 },
    xp_500: { current: totalXp, unlocked: totalXp >= 500 },
    xp_2000: { current: totalXp, unlocked: totalXp >= 2000 },
    streak_3_days: { current: maxStreak, unlocked: maxStreak >= 3 },
    consistency_20_sessions: { current: totalSessions, unlocked: totalSessions >= 20 },
    aws_legend: {
      current: (totalXp >= 5000 ? 1 : 0) + (simuladoPassed.length >= 5 ? 1 : 0),
      unlocked: totalXp >= 5000 && simuladoPassed.length >= 5,
    },
  };
}

export async function ensureAchievementCatalog() {
  await prisma.$transaction(
    ACHIEVEMENT_DEFS.map((achievement) =>
      prisma.achievement.upsert({
        where: { code: achievement.code },
        create: {
          code: achievement.code,
          name: achievement.name,
          description: achievement.description,
          rarity: achievement.rarity,
          generationPrompt: achievement.prompt,
          displayOrder: achievement.displayOrder,
          active: true,
        },
        update: {
          name: achievement.name,
          description: achievement.description,
          rarity: achievement.rarity,
          generationPrompt: achievement.prompt,
          displayOrder: achievement.displayOrder,
          active: true,
        },
      }),
    ),
  );
}

async function getUserEvents(userId: string) {
  const [questHistory, studyHistory] = await Promise.all([
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
      },
      orderBy: { completedAt: "asc" },
      take: 2000,
    }),
  ]);

  return {
    questHistory,
    studyHistory: studyHistory.map((item) => ({
      ...item,
      sessionType: item.sessionType as "KC" | "SIMULADO",
    })),
  };
}

export async function syncUserAchievements(userId: string): Promise<void> {
  await ensureAchievementCatalog();

  const [events, achievementCatalog] = await Promise.all([
    getUserEvents(userId),
    prisma.achievement.findMany({
      where: { active: true },
      select: { id: true, code: true },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const metrics = computeMetrics(events);

  const unlockables = achievementCatalog.filter((achievement) => metrics[achievement.code]?.unlocked);
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
          progress: Math.max(0, metrics[achievement.code]?.current ?? 0),
        },
        update: {
          progress: Math.max(0, metrics[achievement.code]?.current ?? 0),
        },
      }),
    ),
  );
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

  const metrics = computeMetrics(events);
  const ownedMap = new Map(owned.map((item) => [item.achievementId, item.unlockedAt]));
  const defsMap = new Map(ACHIEVEMENT_DEFS.map((item) => [item.code, item]));

  const items: AchievementItem[] = catalog.map((achievement) => {
    const metric = metrics[achievement.code] ?? { current: 0, unlocked: false };
    const def = defsMap.get(achievement.code);
    const target = def?.target ?? 1;
    const unlockedAt = ownedMap.get(achievement.id);

    return {
      id: achievement.id,
      code: achievement.code,
      name: achievement.name,
      description: achievement.description,
      rarity: (achievement.rarity as AchievementItem["rarity"]) ?? "common",
      imageUrl: achievement.imageUrl,
      unlocked: Boolean(unlockedAt) || metric.unlocked,
      unlockedAt: unlockedAt ? unlockedAt.toISOString() : null,
      current: metric.current,
      target,
      progressPercent: clampPercent((metric.current / Math.max(1, target)) * 100),
    };
  });

  return {
    total: items.length,
    unlockedCount: items.filter((item) => item.unlocked).length,
    items,
  };
}
