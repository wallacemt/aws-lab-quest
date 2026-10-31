import { NextRequest, NextResponse } from "next/server";
import { syncAndGetNewAchievements } from "@/lib/achievements";
import { getOrCreateActiveJourney, resolveJourneyFilter } from "@/lib/certification-journey";
import { requireApprovedUser } from "@/lib/user-auth";
import { cacheDel, cacheGetOrSet, CACHE_KEYS, CACHE_TTL } from "@/lib/cache";
import { GapAnswerResult, updateGapProgress } from "@/lib/gap-progress";
import { getTaskXpByDifficulty } from "@/lib/levels";
import { prisma } from "@/lib/prisma";
import { publishLeaderboardUpdatedEvent } from "@/lib/realtime-events";
import { isCorrectAnswer, isOptionKey, normalizeQuestionType } from "@/lib/study-answer-utils";
import { QuestionOption, QuestionOptionMapping } from "@/lib/types";
import { applyWeightedXp, listXpWeightsByActivity, resolveXpWeight, XpActivityType } from "@/lib/xp-weights";
import { recordStudyActivity } from "@/lib/streak";
import { readJsonWithBodyLimit, sanitizeSnapshotItem } from "@/lib/study-snapshot";

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

// Options are re-shuffled every time a question is served (mapDbQuestionToStudyQuestion),
// so the letter the user clicked ("display" letter, e.g. "D") only means something relative
// to that session's optionMapping. The DB's correctOption/correctOptions are always in the
// canonical (unshuffled) letters, so the user's pick must be translated back before compare.
function toCanonicalOption(
  value: unknown,
  mapping: QuestionOptionMapping | undefined,
): QuestionOption | undefined {
  if (!isOptionKey(value)) {
    return undefined;
  }
  return mapping?.displayToOriginal?.[value] ?? value;
}

function toCanonicalOptions(value: unknown, mapping: QuestionOptionMapping | undefined): QuestionOption[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const result: QuestionOption[] = [];
  for (const item of value) {
    const canonical = toCanonicalOption(item, mapping);
    if (canonical) {
      result.push(canonical);
    }
  }
  return result;
}

export async function GET(request: NextRequest) {
  const auth = await requireApprovedUser(request);
  if (auth.response) return auth.response;

  const history = await cacheGetOrSet(
    CACHE_KEYS.userStudyHistory(auth.user.id),
    async () => {
      const journeyId = await resolveJourneyFilter(auth.user.id);
      const sessions = await prisma.studySessionHistory.findMany({
        where: { userId: auth.user.id, journeyId },
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

  const parsed = await readJsonWithBodyLimit(request);
  if (parsed.error === "too-large") {
    return NextResponse.json({ error: "Request body exceeds 1 MB." }, { status: 413 });
  }
  if (parsed.error || !parsed.body || typeof parsed.body !== "object" || Array.isArray(parsed.body)) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const body = parsed.body as Body;

  if (body.sessionType !== "KC" && body.sessionType !== "SIMULADO") {
    return NextResponse.json({ error: "Invalid sessionType." }, { status: 400 });
  }
  if (!body.title) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const receivedSnapshot = Array.isArray(body.answersSnapshot) ? body.answersSnapshot.slice(0, 120) : [];
  const snapshot = [] as StudyHistoryItem[];
  for (const candidate of receivedSnapshot) {
    const sanitized = sanitizeSnapshotItem(candidate);
    if (sanitized.error) {
      return NextResponse.json({ error: `Snapshot field exceeds its limit: ${sanitized.error}.` }, { status: 400 });
    }
    if (sanitized.item) snapshot.push(sanitized.item as unknown as StudyHistoryItem);
  }
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
        statement: true,
        optionA: true,
        optionB: true,
        optionC: true,
        optionD: true,
        optionE: true,
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
  const persistedSnapshot = snapshot.map((answer) => {
    const question = questionMap.get(answer.questionId);
    if (!question) {
      return {
        questionId: answer.questionId,
        selectedOption: answer.selectedOption,
        ...(Array.isArray(answer.selectedOptions) ? { selectedOptions: answer.selectedOptions } : {}),
      };
    }

    const canonicalOptions: Record<string, string> = {
      A: question.optionA,
      B: question.optionB,
      C: question.optionC,
      D: question.optionD,
      ...(question.optionE ? { E: question.optionE } : {}),
    };
    const mapping = answer.optionMapping;
    const options = Object.fromEntries(
      Object.entries(canonicalOptions).map(([canonicalKey, text]) => {
        const displayKey = mapping?.originalToDisplay?.[canonicalKey as QuestionOption] ?? canonicalKey;
        return [displayKey, text];
      }),
    );
    const correctOptions = Array.isArray(question.correctOptions)
      ? question.correctOptions.filter((value): value is string => typeof value === "string")
      : [question.correctOption];

    return {
      ...answer,
      statement: question.statement,
      options,
      correctOption: mapping?.originalToDisplay?.[question.correctOption as QuestionOption] ?? question.correctOption,
      correctOptions: correctOptions.map((option) => mapping?.originalToDisplay?.[option as QuestionOption] ?? option),
    };
  });

  let correctAnswers = 0;
  let computedXp = 0;
  let scoredQuestions = 0;

  for (const answer of snapshot) {
    const question = questionMap.get(answer.questionId);
    if (!question) continue; // unknown question id — not part of the scored set

    scoredQuestions += 1;

    const isCorrect = isCorrectAnswer({
      questionType: normalizeQuestionType(question.questionType),
      selectedOption: toCanonicalOption(answer.selectedOption, answer.optionMapping),
      selectedOptions: toCanonicalOptions(answer.selectedOptions, answer.optionMapping),
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
      answersSnapshot: persistedSnapshot,
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
