import { prisma } from "@/lib/prisma";

export type XpActivityType = "LAB" | "KC" | "SIMULADO";

type XpWeightConfigItem = {
  activityType: string;
  topic: string;
  difficulty: string;
  multiplier: number;
  bonusXp: number;
};

export type ResolvedXpWeight = {
  multiplier: number;
  bonusXp: number;
};

const DEFAULT_WEIGHT: ResolvedXpWeight = {
  multiplier: 1,
  bonusXp: 0,
};

function normalizeWeightToken(value: string | null | undefined): string {
  if (!value) return "*";

  const cleaned = value.trim().toUpperCase();
  if (!cleaned || cleaned === "ALL") return "*";
  return cleaned;
}

function computePriority(item: XpWeightConfigItem, activityType: string, topic: string, difficulty: string): number {
  if (item.activityType !== activityType && item.activityType !== "*") {
    return Number.NEGATIVE_INFINITY;
  }

  if (item.topic !== topic && item.topic !== "*") {
    return Number.NEGATIVE_INFINITY;
  }

  if (item.difficulty !== difficulty && item.difficulty !== "*") {
    return Number.NEGATIVE_INFINITY;
  }

  let score = 0;

  score += item.activityType === activityType ? 100 : 0;
  score += item.topic === topic ? 10 : 1;
  score += item.difficulty === difficulty ? 2 : 0;

  return score;
}

export async function listXpWeightsByActivity(activityType: XpActivityType): Promise<XpWeightConfigItem[]> {
  return prisma.xpWeightConfig.findMany({
    where: {
      active: true,
      activityType: {
        in: [activityType, "*"],
      },
    },
    select: {
      activityType: true,
      topic: true,
      difficulty: true,
      multiplier: true,
      bonusXp: true,
    },
  });
}

export function resolveXpWeight(
  weights: XpWeightConfigItem[],
  input: {
    activityType: XpActivityType;
    topic?: string | null;
    difficulty?: string | null;
  },
): ResolvedXpWeight {
  const activityType = normalizeWeightToken(input.activityType);
  const topic = normalizeWeightToken(input.topic);
  const difficulty = normalizeWeightToken(input.difficulty);

  let best: XpWeightConfigItem | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const item of weights) {
    const score = computePriority(
      {
        activityType: normalizeWeightToken(item.activityType),
        topic: normalizeWeightToken(item.topic),
        difficulty: normalizeWeightToken(item.difficulty),
        multiplier: item.multiplier,
        bonusXp: item.bonusXp,
      },
      activityType,
      topic,
      difficulty,
    );

    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }

  if (!best) {
    return DEFAULT_WEIGHT;
  }

  return {
    multiplier: best.multiplier,
    bonusXp: best.bonusXp,
  };
}

export function applyWeightedXp(baseXp: number, weight: ResolvedXpWeight): number {
  const weighted = baseXp * weight.multiplier + weight.bonusXp;
  return Math.max(0, Math.round(weighted));
}
