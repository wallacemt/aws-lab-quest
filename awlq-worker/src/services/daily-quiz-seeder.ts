import { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { logger } from "../shared/logger.js";

// DEF-028: Restrict quiz questions to single-select only.
// correctOptions is a nullable Json column; { equals: Prisma.DbNull } matches SQL IS NULL,
// which identifies single-select questions (multi-select questions have a non-null array).
const SINGLE_SELECT_FILTER = { correctOptions: { equals: Prisma.DbNull } } as const;

const DAILY_QUIZ_QUESTION_COUNT = 5;
const DEDUP_WINDOW_DAYS = 30;

/**
 * Seeds today's DailyQuiz row with 5 random questions.
 * Excludes question IDs that appeared in any DailyQuiz within the last 30 days
 * to avoid repeating recent questions.
 */
export async function seedDailyQuiz(): Promise<void> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const existing = await prisma.dailyQuiz.findUnique({
    where: { quizDate: today },
  });

  if (existing) {
    logger.info({ quizDate: today.toISOString() }, "daily-quiz: already seeded for today, skipping");
    return;
  }

  // Collect question IDs used in the last 30 days to avoid repeats.
  const windowStart = new Date(today);
  windowStart.setDate(windowStart.getDate() - DEDUP_WINDOW_DAYS);

  const recentQuizzes = await prisma.dailyQuiz.findMany({
    where: { quizDate: { gte: windowStart } },
    select: { questionIds: true },
  });

  const recentIds = new Set<string>();
  for (const quiz of recentQuizzes) {
    const ids = quiz.questionIds as string[];
    for (const id of ids) {
      recentIds.add(id);
    }
  }

  // Fetch a pool large enough to randomly sample from, excluding recent.
  // DEF-028: filter to single-select questions only so every seeded question
  // is scorable by the daily-quiz scoring route (which drops multi-select answers).
  const pool = await prisma.studyQuestion.findMany({
    where: {
      active: true,
      ...SINGLE_SELECT_FILTER,
      id: recentIds.size > 0 ? { notIn: [...recentIds] } : undefined,
    },
    select: { id: true },
    take: DAILY_QUIZ_QUESTION_COUNT * 10,
  });

  if (pool.length < DAILY_QUIZ_QUESTION_COUNT) {
    // Pool exhausted — fall back to any active single-select questions including recent ones.
    logger.warn(
      { poolSize: pool.length, needed: DAILY_QUIZ_QUESTION_COUNT },
      "daily-quiz: pool smaller than needed, falling back to full pool",
    );
    const fallback = await prisma.studyQuestion.findMany({
      where: { active: true, ...SINGLE_SELECT_FILTER },
      select: { id: true },
      take: DAILY_QUIZ_QUESTION_COUNT * 3,
    });
    pool.push(...fallback);
  }

  // Shuffle and pick the required number.
  const shuffled = pool.sort(() => Math.random() - 0.5).slice(0, DAILY_QUIZ_QUESTION_COUNT);
  const questionIds = shuffled.map((q) => q.id);

  await prisma.dailyQuiz.create({
    data: {
      quizDate: today,
      questionIds,
    },
  });

  logger.info({ quizDate: today.toISOString(), questionIds }, "daily-quiz: seeded successfully");
}
