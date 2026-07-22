import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireApprovedUser } from "@/lib/user-auth";
import { prisma } from "@/lib/prisma";
import { syncAndGetNewAchievements } from "@/lib/achievements";
import { applyWeightedXp, listXpWeightsByActivity, resolveXpWeight } from "@/lib/xp-weights";
import { getTaskXpByDifficulty } from "@/lib/levels";
import { publishWeeklyChallengeUpdatedEvent } from "@/lib/realtime-events";
import { cacheDel, CACHE_KEYS } from "@/lib/cache";

type AnswerItem = {
  questionId: string;
  selectedOption: number;
};

const WEEKLY_CHALLENGE_ACTIVITY = "weekly_challenge" as const;

// DEF-021: filter expression that restricts to single-select questions only.
// For nullable Json columns, the WHERE IS NULL predicate uses { equals: Prisma.DbNull }.
const SINGLE_SELECT_FILTER = { correctOptions: { equals: Prisma.DbNull } };

/**
 * GET /api/weekly-challenge
 * Returns the current active challenge, the user's entry, and the top-10 leaderboard.
 */
export async function GET(request: NextRequest) {
  const auth = await requireApprovedUser(request);
  if (auth.response) return auth.response;

  const { user } = auth;

  const challenge = await prisma.weeklyChallenge.findFirst({
    where: { active: true },
    orderBy: { weekStart: "desc" },
  });

  if (!challenge) {
    return NextResponse.json({ challenge: null, entry: null, leaderboard: [], submitted: false });
  }

  const [userEntry, topEntries] = await Promise.all([
    prisma.weeklyChallengeEntry.findUnique({
      where: { challengeId_userId: { challengeId: challenge.id, userId: user.id } },
      select: {
        score: true,
        rank: true,
        gainedXp: true,
        updatedAt: true,
        user: { select: { name: true, profile: { select: { avatarUrl: true } } } },
      },
    }),
    prisma.weeklyChallengeEntry.findMany({
      where: { challengeId: challenge.id },
      orderBy: [{ score: "desc" }, { updatedAt: "asc" }],
      take: 10,
      select: {
        userId: true,
        score: true,
        rank: true,
        user: { select: { name: true, profile: { select: { avatarUrl: true } } } },
      },
    }),
  ]);

  // liveRank: a provisional standing computed on the fly while the challenge is
  // still open (the stored `rank` column only gets set once closeWeeklyChallenge
  // runs on Sunday) — lets a user know "you're currently #11" mid-week.
  let liveRank: number | null = null;
  if (userEntry) {
    if (userEntry.rank !== null) {
      liveRank = userEntry.rank;
    } else {
      const higherCount = await prisma.weeklyChallengeEntry.count({
        where: {
          challengeId: challenge.id,
          OR: [
            { score: { gt: userEntry.score } },
            { score: userEntry.score, updatedAt: { lt: userEntry.updatedAt } },
          ],
        },
      });
      liveRank = higherCount + 1;
    }
  }

  return NextResponse.json({
    challenge: {
      id: challenge.id,
      title: challenge.title,
      weekStart: challenge.weekStart.toISOString(),
      weekEnd: challenge.weekEnd.toISOString(),
      active: challenge.active,
    },
    entry: userEntry
      ? {
          userId: user.id,
          score: userEntry.score,
          rank: userEntry.rank,
          liveRank,
          gainedXp: userEntry.gainedXp,
          name: userEntry.user.name,
          avatarUrl: userEntry.user.profile?.avatarUrl ?? null,
        }
      : null,
    leaderboard: topEntries.map((e) => ({
      userId: e.userId,
      score: e.score,
      rank: e.rank,
      name: e.user.name,
      avatarUrl: e.user.profile?.avatarUrl ?? null,
    })),
    submitted: userEntry !== null,
  });
}

/**
 * POST /api/weekly-challenge
 * Submits answers for the current weekly challenge.
 * Enforces one submission per user per challenge (409 if already submitted).
 */
export async function POST(request: NextRequest) {
  const auth = await requireApprovedUser(request);
  if (auth.response) return auth.response;

  const { user } = auth;

  let body: { answers: AnswerItem[] };
  try {
    body = (await request.json()) as { answers: AnswerItem[] };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!Array.isArray(body.answers) || body.answers.length === 0) {
    return NextResponse.json({ error: "answers[] is required." }, { status: 400 });
  }

  const challenge = await prisma.weeklyChallenge.findFirst({
    where: { active: true },
    orderBy: { weekStart: "desc" },
  });

  if (!challenge) {
    return NextResponse.json({ error: "No active weekly challenge." }, { status: 404 });
  }

  // DEF-019: Load the submitted question IDs from the database so only valid,
  // active questions can be scored. Answers referencing non-existent or inactive
  // questions are ignored, preventing arbitrary question harvesting.
  // Also restrict to the challenge's fixed questionIds (when set) so a user can't
  // submit answers for questions outside their assigned weekly set.
  // DEF-021: Restrict to single-select questions only (correctOptions must be null).
  const authorizedIds = Array.isArray(challenge.questionIds) ? (challenge.questionIds as string[]) : [];
  const submittedIds = body.answers.map((a) => a.questionId);
  const idsToScore =
    authorizedIds.length > 0 ? submittedIds.filter((id) => authorizedIds.includes(id)) : submittedIds;

  const questions = await prisma.studyQuestion.findMany({
    where: {
      id: { in: idsToScore },
      active: true,
      // DEF-021: exclude multi-select questions — Prisma.DbNull matches SQL NULL on
      // the nullable Json column, filtering out any multi-select question.
      ...SINGLE_SELECT_FILTER,
    },
    select: {
      id: true,
      statement: true,
      correctOption: true,
      topic: true,
      difficulty: true,
      optionA: true,
      optionB: true,
      optionC: true,
      optionD: true,
      optionE: true,
      explanationA: true,
      explanationB: true,
      explanationC: true,
      explanationD: true,
      explanationE: true,
    },
  });

  // Collapse duplicate question submissions by keeping the first answer per ID.
  const questionMap = new Map(questions.map((q) => [q.id, q]));
  const seenIds = new Set<string>();
  const validatedAnswers = body.answers.filter((a) => {
    if (!questionMap.has(a.questionId) || seenIds.has(a.questionId)) return false;
    seenIds.add(a.questionId);
    return true;
  });

  let correctCount = 0;
  for (const answer of validatedAnswers) {
    const question = questionMap.get(answer.questionId);
    if (!question) continue;
    const optionLetter = ["A", "B", "C", "D", "E"][answer.selectedOption];
    if (optionLetter && question.correctOption.toUpperCase() === optionLetter) {
      correctCount++;
    }
  }

  const score = correctCount;
  const totalCount = validatedAnswers.length;
  const weights = await listXpWeightsByActivity(WEEKLY_CHALLENGE_ACTIVITY);

  const gainedXp = validatedAnswers.reduce((total, answer) => {
    const question = questionMap.get(answer.questionId);
    if (!question) return total;
    const optionLetter = ["A", "B", "C", "D", "E"][answer.selectedOption];
    if (!optionLetter || question.correctOption.toUpperCase() !== optionLetter) return total;
    const difficulty = (question.difficulty ?? "medium") as "easy" | "medium" | "hard";
    const topic = question.topic ?? "*";
    const baseXp = Math.max(20, Math.round(getTaskXpByDifficulty(difficulty) / 3));
    const weight = resolveXpWeight(weights, { activityType: WEEKLY_CHALLENGE_ACTIVITY, topic, difficulty });
    return total + applyWeightedXp(baseXp, weight);
  }, 0);

  // LSF-2026-003: wrap the duplicate-check and entry creation in a single
  // transaction. This closes the TOCTOU window between the check and the insert.
  // The unique constraint on (challengeId, userId) is the hard backstop; the
  // transaction narrows the window to a negligible serialization race.
  const since = new Date();
  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.weeklyChallengeEntry.findUnique({
        where: { challengeId_userId: { challengeId: challenge.id, userId: user.id } },
        select: { id: true },
      });
      if (existing) throw new Error("ALREADY_SUBMITTED");

      await tx.weeklyChallengeEntry.create({
        data: {
          challengeId: challenge.id,
          userId: user.id,
          score,
          gainedXp,
        },
      });
    });
  } catch (err) {
    if (err instanceof Error && err.message === "ALREADY_SUBMITTED") {
      return NextResponse.json({ error: "Already submitted for this week." }, { status: 409 });
    }
    throw err;
  }

  // Full snapshot shape (matches StudyAnswerSnapshotPayload) so the shared history
  // review UI can render it — a bare {questionId, selectedOption} crashes that UI
  // (same fix already applied to the daily-quiz and sprint routes).
  const answersSnapshot = validatedAnswers
    .map((answer) => {
      const question = questionMap.get(answer.questionId);
      if (!question) return null;
      const selected = ["A", "B", "C", "D", "E"][answer.selectedOption] ?? "-";
      return {
        questionId: question.id,
        statement: question.statement,
        questionType: "single" as const,
        selectedOption: selected,
        selectedOptions: [selected],
        correctOption: question.correctOption,
        correctOptions: [question.correctOption],
        options: {
          A: question.optionA,
          B: question.optionB,
          C: question.optionC,
          D: question.optionD,
          ...(question.optionE ? { E: question.optionE } : {}),
        },
        explanations: {
          A: question.explanationA ?? "Sem explicacao.",
          B: question.explanationB ?? "Sem explicacao.",
          C: question.explanationC ?? "Sem explicacao.",
          D: question.explanationD ?? "Sem explicacao.",
          ...(question.optionE ? { E: question.explanationE ?? "Sem explicacao." } : {}),
        },
      };
    })
    .filter((item) => item !== null);

  const historyItem = await prisma.studySessionHistory.create({
    data: {
      userId: user.id,
      sessionType: "KC",
      title: `Desafio Semanal — ${correctCount}/${totalCount} corretas`,
      gainedXp,
      scorePercent: totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0,
      correctAnswers: correctCount,
      totalQuestions: totalCount,
      answersSnapshot,
      completedAt: new Date(),
    },
    select: { id: true },
  });

  const [newAchievements] = await Promise.all([
    syncAndGetNewAchievements(user.id, since),
    cacheDel(
      CACHE_KEYS.userStudyHistory(user.id),
      CACHE_KEYS.userPublicProfile(user.id),
      CACHE_KEYS.userAchievements(user.id),
      CACHE_KEYS.leaderboard(),
    ),
  ]);

  await publishWeeklyChallengeUpdatedEvent({ userId: user.id, score });

  return NextResponse.json({ score, gainedXp, newAchievements, historyId: historyItem.id });
}
