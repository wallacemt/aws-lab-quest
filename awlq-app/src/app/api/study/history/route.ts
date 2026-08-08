import { NextRequest, NextResponse } from "next/server";
import { syncAndGetNewAchievements } from "@/lib/achievements";
import { getOrCreateActiveJourney } from "@/lib/certification-journey";
import { requireApprovedUser } from "@/lib/user-auth";
import { cacheDel, cacheGetOrSet, CACHE_KEYS, CACHE_TTL } from "@/lib/cache";
import { GapAnswerResult, updateGapProgress } from "@/lib/gap-progress";
import { getTaskXpByDifficulty } from "@/lib/levels";
import { prisma } from "@/lib/prisma";
import { publishLeaderboardUpdatedEvent } from "@/lib/realtime-events";
import { isCorrectAnswer, normalizeQuestionType } from "@/lib/study-answer-utils";
import { QuestionOptionMapping } from "@/lib/types";
import { applyWeightedXp, listXpWeightsByActivity, resolveXpWeight, XpActivityType } from "@/lib/xp-weights";
import { recordStudyActivity } from "@/lib/streak";

type StudyHistoryItem = {
  questionId: string;
  statement: string;
  questionType?: "single" | "multi";
  selectedOption: string;
  selectedOptions?: string[];
  correctOption: string;
  correctOptions?: string[];
  options: Record<string, string>;
  explanations: Record<string, string>;
  optionMapping?: QuestionOptionMapping;
};

type Body = {
  sessionType?: "KC" | "SIMULADO";
  title?: string;
  certificationCode?: string;
  gainedXp?: number;
  scorePercent?: number;
  correctAnswers?: number;
  totalQuestions?: number;
  durationSeconds?: number;
  answersSnapshot?: StudyHistoryItem[];
  packId?: string;
};

function toTaskDifficulty(value: string | undefined): "easy" | "medium" | "hard" {
  if (value === "easy" || value === "medium" || value === "hard") {
    return value;
  }
  return "medium";
}

export async function GET(request: NextRequest) {
  const auth = await requireApprovedUser(request);
  if (auth.response) return auth.response;

  const history = await cacheGetOrSet(
    CACHE_KEYS.userStudyHistory(auth.user.id),
    async () => {
      const sessions = await prisma.studySessionHistory.findMany({
        where: { userId: auth.user.id },
        orderBy: { completedAt: "desc" },
        take: 50,
        include: { pack: { select: { name: true, artworkUrl: true } } },
      });
      return sessions.map((s) => ({
        ...s,
        packName: s.pack?.name ?? null,
        packArtworkUrl: s.pack?.artworkUrl ?? null,
        pack: undefined,
      }));
    },
    CACHE_TTL.USER_HISTORY,
  );

  return NextResponse.json({ history });
}

export async function POST(request: NextRequest) {
  const auth = await requireApprovedUser(request);
  if (auth.response) return auth.response;

  const body = (await request.json()) as Body;

  if (!body.sessionType || !body.title) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const snapshot = Array.isArray(body.answersSnapshot) ? body.answersSnapshot.slice(0, 120) : [];
  if (snapshot.length === 0) {
    return NextResponse.json({ error: "answersSnapshot is required." }, { status: 400 });
  }

  const gapAnswers: GapAnswerResult[] = [];

  // LSF-2026-101: score and XP are derived only from server-held question data.
  // The client's gainedXp/correctAnswers/totalQuestions/scorePercent and the
  // per-answer correctOption(s) are never trusted — only selectedOption(s) (what
  // the user actually picked) come from the body.
  const questionIds = snapshot
    .map((item) => item.questionId)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  const uniqueIds = Array.from(new Set(questionIds)).slice(0, 200);

  const [questions, weights] = await Promise.all([
    prisma.studyQuestion.findMany({
      where: { id: { in: uniqueIds } },
      select: {
        id: true,
        topic: true,
        difficulty: true,
        awsServiceId: true,
        questionType: true,
        correctOption: true,
        correctOptions: true,
        questionAwsServices: {
          select: {
            service: {
              select: {
                id: true,
                code: true,
              },
            },
          },
        },
      },
    }),
    listXpWeightsByActivity(body.sessionType),
  ]);

  const questionMap = new Map(questions.map((question) => [question.id, question]));

  let correctAnswers = 0;
  let computedXp = 0;
  let scoredQuestions = 0;

  for (const answer of snapshot) {
    const question = questionMap.get(answer.questionId);
    if (!question) continue; // unknown question id — not part of the scored set

    scoredQuestions += 1;

    const isCorrect = isCorrectAnswer({
      questionType: normalizeQuestionType(question.questionType),
      selectedOption: answer.selectedOption,
      selectedOptions: answer.selectedOptions,
      correctOption: question.correctOption,
      correctOptions: question.correctOptions,
    });

    if (body.sessionType === "SIMULADO") {
      gapAnswers.push({
        awsServiceId: question.questionAwsServices?.[0]?.service?.id ?? question.awsServiceId ?? null,
        topic: question.topic,
        isCorrect,
      });
    }

    if (!isCorrect) {
      continue;
    }

    correctAnswers += 1;

    const difficulty = toTaskDifficulty(question.difficulty);
    const normalizedTopic = question.questionAwsServices?.[0]?.service?.code;
    const topic = normalizedTopic ?? question.topic ?? "*";

    const basePerCorrect = Math.max(20, Math.round(getTaskXpByDifficulty(difficulty) / 4));
    const resolvedWeight = resolveXpWeight(weights, {
      activityType: body.sessionType as XpActivityType,
      topic,
      difficulty,
    });

    computedXp += applyWeightedXp(basePerCorrect, resolvedWeight);
  }

  if (scoredQuestions === 0) {
    return NextResponse.json({ error: "No valid questions in answersSnapshot." }, { status: 400 });
  }

  const totalQuestions = scoredQuestions;
  const scorePercent = Math.round((correctAnswers / totalQuestions) * 100);

  const [prevQuestXp, prevStudyXp] = await Promise.all([
    prisma.questHistory.aggregate({ where: { userId: auth.user.id }, _sum: { xp: true } }),
    prisma.studySessionHistory.aggregate({ where: { userId: auth.user.id }, _sum: { gainedXp: true } }),
  ]);
  const prevXp = (prevQuestXp._sum.xp ?? 0) + (prevStudyXp._sum.gainedXp ?? 0);

  const activeJourney = await getOrCreateActiveJourney(auth.user.id);

  const item = await prisma.studySessionHistory.create({
    data: {
      userId: auth.user.id,
      sessionType: body.sessionType,
      title: body.title,
      certificationCode: body.certificationCode ?? null,
      gainedXp: computedXp,
      scorePercent,
      correctAnswers,
      totalQuestions,
      durationSeconds: body.durationSeconds == null ? null : Math.max(0, Math.round(body.durationSeconds)),
      answersSnapshot: snapshot,
      packId: typeof body.packId === "string" && body.packId.length > 0 ? body.packId : null,
      journeyId: activeJourney.id,
      completedAt: new Date(),
    },
  });

  const newXp = prevXp + item.gainedXp;
  const syncSince = new Date();

  void publishLeaderboardUpdatedEvent({
    userId: auth.user.id,
    source: body.sessionType,
    gainedXp: item.gainedXp,
  });

  const [newAchievements] = await Promise.all([
    syncAndGetNewAchievements(auth.user.id, syncSince),
    cacheDel(
      CACHE_KEYS.userStudyHistory(auth.user.id),
      CACHE_KEYS.userPublicProfile(auth.user.id),
      CACHE_KEYS.userAchievements(auth.user.id),
      CACHE_KEYS.leaderboard(),
    ),
    // Enqueue flashcard generation for wrong/slow/flagged answers in this session.
    // Fire-and-forget via WorkerTrigger — never blocks the response.
    prisma.workerTrigger.create({
      data: {
        action: "generate-flashcards",
        source: "session_save",
        payload: { userId: auth.user.id, sinceSessionId: item.id },
      },
    }),
    // Enqueue mentor recompute so recommendations are fresh after each session.
    // Fire-and-forget via WorkerTrigger — never blocks the response.
    prisma.workerTrigger.create({
      data: {
        action: "compute-mentor",
        source: "session_save",
        payload: { userId: auth.user.id },
      },
    }),
    // Record streak for questions activity.
    recordStudyActivity(auth.user.id, "questions", item.totalQuestions),
    // Update gap-clearing streaks for Simulado answers (EPIC-03 #20).
    updateGapProgress(auth.user.id, gapAnswers),
  ]);

  return NextResponse.json({ item, prevXp, newXp, newAchievements }, { status: 201 });
}
