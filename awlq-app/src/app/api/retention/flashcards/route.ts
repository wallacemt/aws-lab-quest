import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeNextReview } from "@/lib/spaced-repetition";
import { recordStudyActivity } from "@/lib/streak";
import { materializeDefaultDeck } from "@/lib/flashcard-templates";
import { FlashcardGrade } from "@prisma/client";

const DUE_CARDS_LIMIT = 20;

type GradeItem = {
  flashcardId: string;
  grade: FlashcardGrade;
};

type PostBody = {
  grades: GradeItem[];
};

/**
 * GET /api/retention/flashcards
 * Returns up to 20 cards due for review today (dueAt <= now, not suspended).
 */
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await materializeDefaultDeck(session.user.id);

  const now = new Date();

  const [cards, dueTotal] = await Promise.all([
    prisma.flashcard.findMany({
      where: {
        userId: session.user.id,
        suspended: false,
        dueAt: { lte: now },
      },
      orderBy: { dueAt: "asc" },
      take: DUE_CARDS_LIMIT,
    }),
    prisma.flashcard.count({
      where: {
        userId: session.user.id,
        suspended: false,
        dueAt: { lte: now },
      },
    }),
  ]);

  return NextResponse.json({ cards, dueTotal });
}

/**
 * POST /api/retention/flashcards
 * Batch grade submission. For each card: applies SM-2, persists FlashcardReview.
 * Body: { grades: { flashcardId, grade }[] }
 */
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!Array.isArray(body.grades) || body.grades.length === 0) {
    return NextResponse.json({ error: "grades array is required and must not be empty." }, { status: 400 });
  }

  const userId = session.user.id;

  // Fetch the user's target exam date for SM-2 interval compression (RNF-08).
  const userProfile = await prisma.userProfile.findUnique({
    where: { userId },
    select: { targetExamDate: true },
  });
  const targetExamDate = userProfile?.targetExamDate ?? undefined;

  // Fetch only cards that belong to this user (IDOR guard).
  const cardIds = body.grades.map((g) => g.flashcardId);
  const ownedCards = await prisma.flashcard.findMany({
    where: { id: { in: cardIds }, userId },
    select: { id: true, easeFactor: true, intervalDays: true, repetitions: true },
  });

  const ownedIds = new Set(ownedCards.map((c) => c.id));
  const cardMap = new Map(ownedCards.map((c) => [c.id, c]));

  let updated = 0;

  // Process grades sequentially to avoid transaction deadlocks on the same card.
  for (const { flashcardId, grade } of body.grades) {
    if (!ownedIds.has(flashcardId)) continue;

    const card = cardMap.get(flashcardId)!;
    const next = computeNextReview(
      { easeFactor: card.easeFactor, intervalDays: card.intervalDays, repetitions: card.repetitions },
      grade,
      targetExamDate ?? undefined,
    );

    await prisma.$transaction([
      prisma.flashcard.update({
        where: { id: flashcardId },
        data: {
          easeFactor: next.easeFactor,
          intervalDays: next.intervalDays,
          repetitions: next.repetitions,
          dueAt: next.dueAt,
          lastReviewedAt: new Date(),
        },
      }),
      prisma.flashcardReview.create({
        data: {
          flashcardId,
          grade,
          prevInterval: card.intervalDays,
          newInterval: next.intervalDays,
        },
      }),
    ]);

    updated += 1;
  }

  // Record streak: count graded cards toward the flashcards threshold.
  await recordStudyActivity(userId, "flashcards", updated);

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 1);

  const [todayCount, tomorrowCount] = await Promise.all([
    prisma.flashcard.count({
      where: { userId, suspended: false, dueAt: { lte: now } },
    }),
    prisma.flashcard.count({
      where: { userId, suspended: false, dueAt: { gte: tomorrow, lt: dayAfter } },
    }),
  ]);

  return NextResponse.json({
    updated,
    nextDueCounts: { today: todayCount, tomorrow: tomorrowCount },
  });
}
