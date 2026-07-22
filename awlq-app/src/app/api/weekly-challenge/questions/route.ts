import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireApprovedUser } from "@/lib/user-auth";
import { prisma } from "@/lib/prisma";

const QUESTION_COUNT = 10;

// Must match the pool the POST /api/weekly-challenge scoring route validates
// answers against: active, single-select questions (correctOptions IS NULL).
const SINGLE_SELECT_FILTER = { correctOptions: { equals: Prisma.DbNull } };

// Never easy. Hard preferred over medium; nightmare weighted even higher.
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
 * Fallback for challenges opened before questionIds was fixed at open time
 * (legacy rows). New challenges always have this set by openWeeklyChallenge().
 */
async function pickFallbackQuestionIds(): Promise<string[]> {
  const pool = await prisma.studyQuestion.findMany({
    where: { active: true, ...SINGLE_SELECT_FILTER, difficulty: { in: ["medium", "hard", "nightmare"] } },
    select: { id: true, difficulty: true },
    take: 3000,
  });
  const weighted = pool.map((q) => ({ id: q.id, weight: DIFFICULTY_WEIGHT[q.difficulty] ?? 1 }));
  return weightedSampleWithoutReplacement(weighted, Math.min(QUESTION_COUNT, weighted.length));
}

/**
 * GET /api/weekly-challenge/questions
 * Returns the fixed question set for the active weekly challenge — the same
 * set for every participant that week, stored on WeeklyChallenge.questionIds
 * at open time. Display order is shuffled per-request, the underlying set is not.
 */
export async function GET(request: NextRequest) {
  const auth = await requireApprovedUser(request);
  if (auth.response) return auth.response;

  const challenge = await prisma.weeklyChallenge.findFirst({
    where: { active: true },
    orderBy: { weekStart: "desc" },
    select: { questionIds: true },
  });

  if (!challenge) {
    return NextResponse.json({ questions: [] });
  }

  const storedIds = Array.isArray(challenge.questionIds) ? (challenge.questionIds as string[]) : [];
  const questionIds = storedIds.length > 0 ? storedIds : await pickFallbackQuestionIds();

  if (questionIds.length === 0) {
    return NextResponse.json({ questions: [] });
  }

  const questions = await prisma.studyQuestion.findMany({
    where: { id: { in: questionIds }, active: true },
    select: {
      id: true,
      statement: true,
      optionA: true,
      optionB: true,
      optionC: true,
      optionD: true,
      optionE: true,
    },
  });

  const shuffled = [...questions];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return NextResponse.json({ questions: shuffled });
}
