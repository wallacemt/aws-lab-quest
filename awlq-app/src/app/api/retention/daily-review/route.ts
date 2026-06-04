import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DUE_FLASHCARDS_LIMIT = 10;
const RECENT_WRONG_LIMIT = 5;
const WEAK_SERVICES_LIMIT = 3;
const RECENT_WRONG_DAYS = 7;
const WEAK_SERVICE_THRESHOLD = 0.6;

/**
 * GET /api/retention/daily-review
 * Assembles the daily review queue with no AI calls in the hot path (RNF-02).
 *
 * Returns:
 * - dueFlashcards: up to 10 cards due today
 * - recentWrong: up to 5 questions answered incorrectly in the last 7 days
 * - weakServices: up to 3 AWS services where correctRate < 60%
 */
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - RECENT_WRONG_DAYS);

  const [dueFlashcards, recentSessions, weakServicePerformance] = await Promise.all([
    // Due flashcards
    prisma.flashcard.findMany({
      where: { userId, suspended: false, dueAt: { lte: now } },
      orderBy: { dueAt: "asc" },
      take: DUE_FLASHCARDS_LIMIT,
    }),

    // Recent sessions for extracting wrong answers
    prisma.studySessionHistory.findMany({
      where: {
        userId,
        completedAt: { gte: sevenDaysAgo },
        anonymized: false,
      },
      orderBy: { completedAt: "desc" },
      take: 10,
      select: { answersSnapshot: true },
    }),

    // Weak AWS services by correctRate (from QuestionPerformance)
    prisma.questionPerformance.findMany({
      where: {
        correctRate: { lt: WEAK_SERVICE_THRESHOLD },
        question: {
          awsServiceId: { not: null },
          active: true,
        },
      },
      orderBy: { correctRate: "asc" },
      take: WEAK_SERVICES_LIMIT * 5, // fetch extra; dedup by service below
      select: {
        correctRate: true,
        question: {
          select: {
            awsServiceId: true,
            awsService: { select: { code: true, name: true } },
          },
        },
      },
    }),
  ]);

  // Collect wrong question ids from recent sessions
  type SnapshotItem = { questionId?: string; correct?: boolean };
  const wrongQuestionIds = new Set<string>();

  for (const session of recentSessions) {
    const snapshot = session.answersSnapshot as SnapshotItem[];
    if (!Array.isArray(snapshot)) continue;
    for (const item of snapshot) {
      if (item.questionId && item.correct === false) {
        wrongQuestionIds.add(item.questionId);
        if (wrongQuestionIds.size >= RECENT_WRONG_LIMIT) break;
      }
    }
    if (wrongQuestionIds.size >= RECENT_WRONG_LIMIT) break;
  }

  const recentWrongQuestions =
    wrongQuestionIds.size > 0
      ? await prisma.studyQuestion.findMany({
          where: { id: { in: Array.from(wrongQuestionIds) }, active: true },
          select: {
            id: true,
            statement: true,
            topic: true,
            difficulty: true,
            awsServiceId: true,
            awsService: { select: { code: true, name: true } },
          },
          take: RECENT_WRONG_LIMIT,
        })
      : [];

  // Deduplicate weak services and cap to limit
  const seenServices = new Set<string>();
  const weakServices: { code: string; name: string; correctRate: number }[] = [];
  for (const perf of weakServicePerformance) {
    const code = perf.question.awsService?.code;
    if (!code || seenServices.has(code)) continue;
    seenServices.add(code);
    weakServices.push({
      code,
      name: perf.question.awsService!.name,
      correctRate: perf.correctRate,
    });
    if (weakServices.length >= WEAK_SERVICES_LIMIT) break;
  }

  return NextResponse.json({
    dueFlashcards,
    recentWrong: recentWrongQuestions,
    weakServices,
  });
}
