import { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { logger } from "../shared/logger.js";

const QUESTION_COUNT = 10;

// Single-select only — correctOptions is a nullable Json column; { equals: Prisma.DbNull }
// matches SQL IS NULL, which identifies single-select questions.
const SINGLE_SELECT_FILTER = { correctOptions: { equals: Prisma.DbNull } } as const;

// Never easy. Hard preferred over medium; nightmare (harder than hard) weighted
// even higher, following the same "prefer harder" curve.
const DIFFICULTY_WEIGHT: Record<string, number> = { nightmare: 4, hard: 3, medium: 1 };

function weightedSampleWithoutReplacement(pool: { id: string; weight: number }[], count: number): string[] {
  const remaining = [...pool];
  const picked: string[] = [];

  for (let i = 0; i < count && remaining.length > 0; i++) {
    const totalWeight = remaining.reduce((sum, item) => sum + item.weight, 0);
    let r = Math.random() * totalWeight;
    let index = 0;
    for (; index < remaining.length - 1; index++) {
      r -= remaining[index].weight;
      if (r <= 0) break;
    }
    picked.push(remaining[index].id);
    remaining.splice(index, 1);
  }

  return picked;
}

/**
 * Picks a fixed set of question IDs for a weekly challenge: independent of
 * certification, never "easy", weighted toward "hard"/"nightmare" over "medium".
 * The same set is stored on the WeeklyChallenge row so every participant answers
 * identical questions that week (fair leaderboard).
 */
export async function pickWeeklyChallengeQuestionIds(): Promise<string[]> {
  const pool = await prisma.studyQuestion.findMany({
    where: {
      active: true,
      ...SINGLE_SELECT_FILTER,
      difficulty: { in: ["medium", "hard", "nightmare"] },
    },
    select: { id: true, difficulty: true },
    take: 3000,
  });

  if (pool.length < QUESTION_COUNT) {
    logger.warn(
      { poolSize: pool.length, needed: QUESTION_COUNT },
      "weekly-challenge-questions: pool smaller than needed",
    );
  }

  const weighted = pool.map((q) => ({ id: q.id, weight: DIFFICULTY_WEIGHT[q.difficulty] ?? 1 }));
  return weightedSampleWithoutReplacement(weighted, Math.min(QUESTION_COUNT, weighted.length));
}
