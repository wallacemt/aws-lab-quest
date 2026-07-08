import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncAndGetNewAchievements } from "@/lib/achievements";
import { cacheDel, CACHE_KEYS } from "@/lib/cache";
import { recordStudyActivity } from "@/lib/streak";
import { getTaskXpByDifficulty } from "@/lib/levels";
import { publishLeaderboardUpdatedEvent } from "@/lib/realtime-events";
import { applyWeightedXp, listXpWeightsByActivity, resolveXpWeight } from "@/lib/xp-weights";

// Sprint modes: each combines a time limit with a matching question count.
const SPRINT_MODE_CONFIG = {
  s3: { count: 5, limitSeconds: 3 * 60 },
  s5: { count: 10, limitSeconds: 5 * 60 },
  s10: { count: 15, limitSeconds: 10 * 60 },
} as const;

type SprintMode = keyof typeof SPRINT_MODE_CONFIG;

function isSprintMode(value: string | null): value is SprintMode {
  return value !== null && value in SPRINT_MODE_CONFIG;
}

// LSF-2026-007: `correct` is NOT accepted from the client.
// Correctness is always computed server-side from the DB answer key.
type AnswerItem = {
  questionId: string;
  selectedOption: string;
};

type PostBody = {
  answers: AnswerItem[];
  mode: string;
};

// DEF-021: filter expression that restricts to single-select questions only.
// correctOptions is a nullable Json column; { equals: Prisma.DbNull } matches SQL NULL.
const SINGLE_SELECT_FILTER = { correctOptions: { equals: Prisma.DbNull } };

const QUESTION_SELECT = {
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
  awsService: { select: { code: true, name: true } },
} satisfies Prisma.StudyQuestionSelect;

// How many of the user's most recent sprints to avoid repeating questions from.
const RECENT_SPRINTS_TO_AVOID = 5;

/**
 * GET /api/retention/sprint?mode=s3|s5|s10
 * Returns a set of single-select questions for a sprint session.
 */
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const modeParam = request.nextUrl.searchParams.get("mode");
  if (!isSprintMode(modeParam)) {
    return NextResponse.json({ error: "mode must be one of: s3, s5, s10" }, { status: 400 });
  }

  const { count, limitSeconds } = SPRINT_MODE_CONFIG[modeParam];
  const baseWhere = { active: true, ...SINGLE_SELECT_FILTER };

  // Avoid repeating questions the user answered in their recent sprints.
  // ponytail: title-prefix match, not a dedicated subtype column — sprints
  // share sessionType "KC" with regular Knowledge Checks (DEF-003). Add a
  // subtype column if another feature ever needs to distinguish them too.
  const recentSprints = await prisma.studySessionHistory.findMany({
    where: { userId: session.user.id, sessionType: "KC", title: { startsWith: "Sprint " } },
    orderBy: { completedAt: "desc" },
    take: RECENT_SPRINTS_TO_AVOID,
    select: { answersSnapshot: true },
  });
  const recentIds = new Set<string>();
  for (const sprint of recentSprints) {
    const snapshot = Array.isArray(sprint.answersSnapshot) ? (sprint.answersSnapshot as { questionId?: string }[]) : [];
    for (const answer of snapshot) if (answer.questionId) recentIds.add(answer.questionId);
  }

  // DEF-021: restrict to single-select questions so the client can score them.
  const freshQuestions = await prisma.studyQuestion.findMany({
    where: { ...baseWhere, id: { notIn: Array.from(recentIds) } },
    select: QUESTION_SELECT,
    orderBy: { createdAt: "desc" },
    take: count * 3, // fetch extra, then sample randomly
  });

  // The unseen pool may be smaller than the requested count (small question bank) —
  // top it off with previously-seen questions rather than returning too few.
  let candidates = freshQuestions;
  if (candidates.length < count) {
    const fallback = await prisma.studyQuestion.findMany({
      where: { ...baseWhere, id: { notIn: candidates.map((q) => q.id) } },
      select: QUESTION_SELECT,
      orderBy: { createdAt: "desc" },
      take: (count - candidates.length) * 3,
    });
    candidates = [...candidates, ...fallback];
  }

  // Randomize and cap — avoids always returning the newest questions.
  const shuffled = candidates.sort(() => Math.random() - 0.5).slice(0, count);

  return NextResponse.json({ questions: shuffled, mode: modeParam, limitSeconds });
}

/**
 * POST /api/retention/sprint
 * Completes a sprint session: calculates score server-side, awards XP, increments streak.
 * Idempotent on streak per calendar day.
 *
 * LSF-2026-007: `correct` is never trusted from the client. The server fetches
 * the answer key for each submitted questionId and computes correctness itself.
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

  // LSF-2026-007: fetch the authoritative answer key server-side.
  // DEF-021: only single-select questions are in the sprint pool.
  const questionIds = answers.map((a) => a.questionId).filter(Boolean);
  const [dbQuestions, weights] = await Promise.all([
    prisma.studyQuestion.findMany({
      where: { id: { in: questionIds }, active: true, ...SINGLE_SELECT_FILTER },
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
    }),
    listXpWeightsByActivity("sprint" as Parameters<typeof listXpWeightsByActivity>[0]),
  ]);

  const questionMap = new Map(dbQuestions.map((q) => [q.id, q]));

  // Compute correctness server-side — ignore any `correct` field the client may have sent.
  const SPRINT_ACTIVITY: Parameters<typeof listXpWeightsByActivity>[0] = "sprint";
  let correctCount = 0;

  const gainedXp = answers.reduce((total, answer) => {
    const question = questionMap.get(answer.questionId);
    if (!question) return total; // unknown question ID — skip

    const isCorrect =
      answer.selectedOption?.toUpperCase() === question.correctOption?.toUpperCase();
    if (isCorrect) correctCount++;

    if (!isCorrect) return total;

    const difficulty = (question.difficulty ?? "medium") as "easy" | "medium" | "hard";
    const topic = question.topic ?? "*";
    const baseXp = Math.max(20, Math.round(getTaskXpByDifficulty(difficulty) / 4));
    const weight = resolveXpWeight(weights, { activityType: SPRINT_ACTIVITY, topic, difficulty });
    return total + applyWeightedXp(baseXp, weight);
  }, 0);

  const scorePercent = answers.length > 0 ? Math.round((correctCount / answers.length) * 100) : 0;

  // Persist sprint XP through the same StudySessionHistory path as KC/Simulado (DEF-003 fix).
  const sprintTitle = `Sprint ${body.mode.toUpperCase()} — ${correctCount}/${answers.length} corretas`;

  // Full snapshot shape (matches StudyAnswerSnapshotPayload) so the shared history
  // review UI can render it — a bare {questionId, selectedOption} crashes that UI
  // when it tries to read answer.options/explanations.
  const answersSnapshot = answers
    .map((answer) => {
      const question = questionMap.get(answer.questionId);
      if (!question) return null;
      const selected = answer.selectedOption?.toUpperCase() ?? "-";
      return {
        questionId: answer.questionId,
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
      userId,
      sessionType: "KC", // sprint is a KC-style micro-session
      title: sprintTitle,
      gainedXp,
      scorePercent,
      correctAnswers: correctCount,
      totalQuestions: answers.length,
      answersSnapshot,
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
