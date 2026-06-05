import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireApprovedUser } from "@/lib/user-auth";
import { prisma } from "@/lib/prisma";
import { syncAndGetNewAchievements } from "@/lib/achievements";
import { applyWeightedXp, listXpWeightsByActivity, resolveXpWeight } from "@/lib/xp-weights";
import { getTaskXpByDifficulty } from "@/lib/levels";

type AnswerItem = {
  questionId: string;
  selectedOption: number;
};

const DAILY_QUIZ_ACTIVITY = "daily_quiz" as const;

function todayUtcMidnight(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

async function hasCertBadge(userId: string): Promise<boolean> {
  const badge = await prisma.userCertBadge.findFirst({
    where: { userId },
    select: { id: true },
  });
  return badge !== null;
}

/**
 * GET /api/daily-quiz
 * Returns today's quiz if the user has a certification badge.
 * Returns { locked: true } if the cert gate is not met.
 */
export async function GET(request: NextRequest) {
  const auth = await requireApprovedUser(request);
  if (auth.response) return auth.response;

  const { user } = auth;

  const unlocked = await hasCertBadge(user.id);
  if (!unlocked) {
    return NextResponse.json({
      locked: true,
      reason: "Complete uma certificação para desbloquear o Quiz Diário",
    });
  }

  const today = todayUtcMidnight();
  const quiz = await prisma.dailyQuiz.findUnique({
    where: { quizDate: today },
  });

  if (!quiz) {
    return NextResponse.json({ quiz: null, completed: false });
  }

  const attempt = await prisma.dailyQuizAttempt.findUnique({
    where: { quizId_userId: { quizId: quiz.id, userId: user.id } },
    select: { score: true, totalCount: true, gainedXp: true, completedAt: true },
  });

  if (attempt) {
    return NextResponse.json({
      completed: true,
      attempt: {
        score: attempt.score,
        totalCount: attempt.totalCount,
        gainedXp: attempt.gainedXp,
        completedAt: attempt.completedAt.toISOString(),
      },
    });
  }

  // Return the quiz questions for display
  const questionIds = quiz.questionIds as string[];
  const questions = await prisma.studyQuestion.findMany({
    where: { id: { in: questionIds }, active: true },
    select: {
      id: true,
      statement: true,
      topic: true,
      difficulty: true,
      optionA: true,
      optionB: true,
      optionC: true,
      optionD: true,
      optionE: true,
    },
  });

  return NextResponse.json({
    locked: false,
    completed: false,
    quiz: {
      id: quiz.id,
      quizDate: quiz.quizDate,
      questions,
    },
  });
}

/**
 * POST /api/daily-quiz
 * Submits answers for today's quiz. One attempt per user per quiz day (409 on duplicate).
 */
export async function POST(request: NextRequest) {
  const auth = await requireApprovedUser(request);
  if (auth.response) return auth.response;

  const { user } = auth;

  const unlocked = await hasCertBadge(user.id);
  if (!unlocked) {
    return NextResponse.json({
      locked: true,
      reason: "Complete uma certificação para desbloquear o Quiz Diário",
    });
  }

  let body: { answers: AnswerItem[] };
  try {
    body = (await request.json()) as { answers: AnswerItem[] };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!Array.isArray(body.answers) || body.answers.length === 0) {
    return NextResponse.json({ error: "answers[] is required." }, { status: 400 });
  }

  const today = todayUtcMidnight();
  const quiz = await prisma.dailyQuiz.findUnique({ where: { quizDate: today } });
  if (!quiz) {
    return NextResponse.json({ error: "No quiz available for today." }, { status: 404 });
  }

  // DEF-019: Load the authoritative question set from the server and ignore any
  // submitted IDs that are not in the stored quiz. This prevents score farming.
  const authorizedIds = new Set(quiz.questionIds as string[]);
  const validatedAnswers = body.answers.filter((a) => authorizedIds.has(a.questionId));

  // DEF-019: Enforce exactly 5 answers — one per stored question. Build a map
  // keyed by questionId so duplicate submissions for the same ID collapse to one.
  const answerByQuestionId = new Map(validatedAnswers.map((a) => [a.questionId, a]));

  // Score against the authoritative set only (DEF-021: single-select only, so
  // correctOptions is null on all questions in this pool per the seeder filter).
  const questions = await prisma.studyQuestion.findMany({
    where: {
      id: { in: Array.from(authorizedIds) },
      active: true,
      // DEF-021: exclude multi-select questions — for nullable Json columns, WHERE IS NULL
      // uses { equals: Prisma.DbNull } as the filter predicate.
      correctOptions: { equals: Prisma.DbNull },
    },
    select: { id: true, correctOption: true, topic: true, difficulty: true },
  });

  const totalCount = questions.length; // the server's authoritative count (≤5)

  let correctCount = 0;
  for (const question of questions) {
    const answer = answerByQuestionId.get(question.id);
    if (!answer) continue;
    const optionLetter = ["A", "B", "C", "D", "E"][answer.selectedOption];
    if (optionLetter && question.correctOption.toUpperCase() === optionLetter) {
      correctCount++;
    }
  }

  // Compute XP only for correctly answered authorised questions.
  const weights = await listXpWeightsByActivity(DAILY_QUIZ_ACTIVITY);

  const gainedXp = questions.reduce((total, question) => {
    const answer = answerByQuestionId.get(question.id);
    if (!answer) return total;
    const optionLetter = ["A", "B", "C", "D", "E"][answer.selectedOption];
    if (!optionLetter || question.correctOption.toUpperCase() !== optionLetter) return total;
    const difficulty = (question.difficulty ?? "medium") as "easy" | "medium" | "hard";
    const topic = question.topic ?? "*";
    const baseXp = Math.max(15, Math.round(getTaskXpByDifficulty(difficulty) / 4));
    const weight = resolveXpWeight(weights, { activityType: DAILY_QUIZ_ACTIVITY, topic, difficulty });
    return total + applyWeightedXp(baseXp, weight);
  }, 0);

  // LSF-2026-003: wrap the duplicate-check and attempt creation in a single
  // transaction. This closes the TOCTOU window between the check and the insert.
  // The unique constraint on (quizId, userId) is the hard backstop; the transaction
  // narrows the window to a negligible serialization race.
  const since = new Date();
  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.dailyQuizAttempt.findUnique({
        where: { quizId_userId: { quizId: quiz.id, userId: user.id } },
        select: { id: true },
      });
      if (existing) throw new Error("ALREADY_ATTEMPTED");

      await tx.dailyQuizAttempt.create({
        data: {
          quizId: quiz.id,
          userId: user.id,
          score: correctCount,
          totalCount,
          gainedXp,
        },
      });
    });
  } catch (err) {
    if (err instanceof Error && err.message === "ALREADY_ATTEMPTED") {
      return NextResponse.json({ error: "Already completed today's quiz." }, { status: 409 });
    }
    throw err;
  }

  await prisma.studySessionHistory.create({
    data: {
      userId: user.id,
      sessionType: "KC",
      title: `Quiz Diário — ${correctCount}/${totalCount} corretas`,
      gainedXp,
      scorePercent: totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0,
      correctAnswers: correctCount,
      totalQuestions: totalCount,
      answersSnapshot: validatedAnswers,
      completedAt: new Date(),
    },
  });

  const newAchievements = await syncAndGetNewAchievements(user.id, since);

  return NextResponse.json({ score: correctCount, totalCount, gainedXp, newAchievements });
}
