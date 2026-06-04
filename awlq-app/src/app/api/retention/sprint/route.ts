import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncAndGetNewAchievements } from "@/lib/achievements";
import { cacheDel, CACHE_KEYS } from "@/lib/cache";
import { recordStudyActivity } from "@/lib/streak";
import { getTaskXpByDifficulty } from "@/lib/levels";
import { publishLeaderboardUpdatedEvent } from "@/lib/realtime-events";
import { applyWeightedXp, listXpWeightsByActivity, resolveXpWeight } from "@/lib/xp-weights";

// Sprint modes and their question counts / time limits.
const SPRINT_MODE_CONFIG = {
  q5:  { count: 5,  limitSeconds: null },
  q10: { count: 10, limitSeconds: null },
  t3:  { count: 10, limitSeconds: 3 * 60 },
  t5:  { count: 10, limitSeconds: 5 * 60 },
} as const;

type SprintMode = keyof typeof SPRINT_MODE_CONFIG;

function isSprintMode(value: string | null): value is SprintMode {
  return value !== null && value in SPRINT_MODE_CONFIG;
}

type AnswerItem = {
  questionId: string;
  correct: boolean;
  selectedOption?: string;
};

type PostBody = {
  answers: AnswerItem[];
  mode: string;
};

/**
 * GET /api/retention/sprint?mode=q5|q10|t3|t5
 * Returns a set of questions for a sprint session.
 */
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const modeParam = request.nextUrl.searchParams.get("mode");
  if (!isSprintMode(modeParam)) {
    return NextResponse.json(
      { error: "mode must be one of: q5, q10, t3, t5" },
      { status: 400 },
    );
  }

  const { count, limitSeconds } = SPRINT_MODE_CONFIG[modeParam];

  const questions = await prisma.studyQuestion.findMany({
    where: { active: true },
    select: {
      id: true,
      statement: true,
      topic: true,
      difficulty: true,
      questionType: true,
      optionA: true,
      optionB: true,
      optionC: true,
      optionD: true,
      optionE: true,
      correctOption: true,
      correctOptions: true,
      awsService: { select: { code: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: count * 3, // fetch extra, then sample randomly
  });

  // Randomize and cap — avoids always returning the newest questions.
  const shuffled = questions.sort(() => Math.random() - 0.5).slice(0, count);

  return NextResponse.json({ questions: shuffled, mode: modeParam, limitSeconds });
}

/**
 * POST /api/retention/sprint
 * Completes a sprint session: calculates score, awards XP, increments streak.
 * Idempotent on streak per calendar day.
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

  if (!Array.isArray(body.answers) || body.answers.length === 0) {
    return NextResponse.json({ error: "answers array is required." }, { status: 400 });
  }

  const userId = session.user.id;
  const answers = body.answers.slice(0, 20); // cap

  const correctCount = answers.filter((a) => a.correct).length;
  const scorePercent = Math.round((correctCount / answers.length) * 100);

  // Compute XP using the sprint-specific weight config (DEF-005 fix).
  // listXpWeightsByActivity queries by activityType string; casting lets us use
  // the "sprint" activityType seeded in XpWeightConfig without changing the lib's
  // typed API (which is scoped to the original "LAB"|"KC"|"SIMULADO" union).
  const SPRINT_ACTIVITY = "sprint" as Parameters<typeof listXpWeightsByActivity>[0];
  const questionIds = answers.map((a) => a.questionId).filter(Boolean);
  const [questions, weights] = await Promise.all([
    prisma.studyQuestion.findMany({
      where: { id: { in: questionIds } },
      select: { id: true, topic: true, difficulty: true },
    }),
    listXpWeightsByActivity(SPRINT_ACTIVITY),
  ]);

  const questionMap = new Map(questions.map((q) => [q.id, q]));

  const gainedXp = answers.reduce((total, answer) => {
    if (!answer.correct) return total;
    const question = questionMap.get(answer.questionId);
    const difficulty = (question?.difficulty ?? "medium") as "easy" | "medium" | "hard";
    const topic = question?.topic ?? "*";
    const baseXp = Math.max(20, Math.round(getTaskXpByDifficulty(difficulty) / 4));
    const weight = resolveXpWeight(weights, { activityType: SPRINT_ACTIVITY, topic, difficulty });
    return total + applyWeightedXp(baseXp, weight);
  }, 0);

  // Persist sprint XP through the same StudySessionHistory path as KC/Simulado (DEF-003 fix).
  // This ensures the leaderboard, achievements, and history reflect the sprint result.
  const sprintTitle = `Sprint ${body.mode.toUpperCase()} — ${correctCount}/${answers.length} corretas`;

  const historyItem = await prisma.studySessionHistory.create({
    data: {
      userId,
      sessionType: "KC", // sprint is a KC-style micro-session
      title: sprintTitle,
      gainedXp,
      scorePercent,
      correctAnswers: correctCount,
      totalQuestions: answers.length,
      answersSnapshot: answers,
      completedAt: new Date(),
    },
    select: { id: true },
  });

  const since = new Date();

  const [streakResult, newAchievements] = await Promise.all([
    recordStudyActivity(userId, "sprint", 1),
    syncAndGetNewAchievements(userId, since),
    cacheDel(
      CACHE_KEYS.userStudyHistory(userId),
      CACHE_KEYS.userPublicProfile(userId),
      CACHE_KEYS.userAchievements(userId),
      CACHE_KEYS.leaderboard(),
    ),
  ]);

  // Fire-and-forget realtime leaderboard event (same pattern as study/history).
  void publishLeaderboardUpdatedEvent({ userId, source: "KC", gainedXp });

  return NextResponse.json({
    scorePercent,
    gainedXp,
    streakDays: streakResult.streakDays,
    newAchievements,
    historyId: historyItem.id,
  });
}
