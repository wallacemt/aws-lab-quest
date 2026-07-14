import { NextRequest, NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/user-auth";
import { prisma } from "@/lib/prisma";
import { syncAndGetNewAchievements } from "@/lib/achievements";
import { applyWeightedXp, listXpWeightsByActivity, resolveXpWeight } from "@/lib/xp-weights";
import { getTaskXpByDifficulty } from "@/lib/levels";
import { recordStudyActivity } from "@/lib/streak";
import { publishLeaderboardUpdatedEvent } from "@/lib/realtime-events";
import { CACHE_KEYS, cacheDel } from "@/lib/cache";

const LETTERS = ["A", "B", "C", "D", "E"] as const;

// Damage doubles every 2 consecutive correct answers and stacks while the streak holds;
// a miss resets it. streak=1→x1, streak=2→x2, streak=3→x2, streak=4→x4, ...
function damageMultiplier(streak: number): number {
  return 2 ** Math.floor(streak / 2);
}

type AnswerItem = {
  questionId: string;
  selectedOption: number;
};

type PostBody = {
  bossId: string;
  answers: AnswerItem[];
};

const BOSS_BATTLE_ACTIVITY = "boss_battle" as const;

// DEF-021: restricts scoring to single-select questions only — kept as defense-in-depth
// alongside the pool-fetch filter in bosses/[bossId]/questions/route.ts (DEF-019/021).
const SINGLE_SELECT_FILTER = { questionType: "single" as const };

type SnapshotQuestion = {
  id: string;
  statement: string;
  correctOption: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  optionE: string | null;
  explanationA: string | null;
  explanationB: string | null;
  explanationC: string | null;
  explanationD: string | null;
  explanationE: string | null;
  cachedExplainSummary: string | null;
};

type BattleSnapshotEntry = {
  questionId: string;
  statement: string;
  questionType: "single";
  selectedOption: string;
  correctOption: string;
  options: Record<string, string>;
  explanations: Record<string, string>;
  explanationSummary?: string;
};

// Builds the review-screen shape (options/explanations by letter) from the raw question row.
function toSnapshotEntry(question: SnapshotQuestion, selectedLetter: string): BattleSnapshotEntry {
  const options: Record<string, string> = {
    A: question.optionA,
    B: question.optionB,
    C: question.optionC,
    D: question.optionD,
  };
  if (question.optionE) options.E = question.optionE;

  const explanations: Record<string, string> = {};
  if (question.explanationA) explanations.A = question.explanationA;
  if (question.explanationB) explanations.B = question.explanationB;
  if (question.explanationC) explanations.C = question.explanationC;
  if (question.explanationD) explanations.D = question.explanationD;
  if (question.explanationE) explanations.E = question.explanationE;

  return {
    questionId: question.id,
    statement: question.statement,
    questionType: "single",
    selectedOption: selectedLetter,
    correctOption: question.correctOption.toUpperCase(),
    options,
    explanations,
    explanationSummary: question.cachedExplainSummary ?? undefined,
  };
}

/**
 * POST /api/arena/battle
 * Submits a set of answers for an ongoing boss battle.
 * Applies damage per correct answer and detects victory.
 */
export async function POST(request: NextRequest) {
  const auth = await requireApprovedUser(request);
  if (auth.response) return auth.response;

  const { user } = auth;

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.bossId || !Array.isArray(body.answers) || body.answers.length === 0) {
    return NextResponse.json({ error: "bossId and answers[] are required." }, { status: 400 });
  }

  const boss = await prisma.boss.findUnique({ where: { id: body.bossId } });
  if (!boss || !boss.active) {
    return NextResponse.json({ error: "Boss not found." }, { status: 404 });
  }

  // LSF-2026-001 victory gate: prevent re-battling an already-defeated boss.
  const priorVictory = await prisma.bossBattle.findFirst({
    where: { userId: user.id, bossId: boss.id, victory: true },
    select: { id: true },
  });
  if (priorVictory) {
    return NextResponse.json({ alreadyDefeated: true }, { status: 409 });
  }

  // Resolve or create the current battle (one active battle per user per boss)
  let battle = await prisma.bossBattle.findFirst({
    where: {
      userId: user.id,
      bossId: boss.id,
      victory: false,
      finishedAt: null,
    },
  });

  if (!battle) {
    battle = await prisma.bossBattle.create({
      data: {
        userId: user.id,
        bossId: boss.id,
        remainingHp: boss.maxHp,
      },
    });
  }

  // DEF-019: Validate submitted question IDs against the boss's authorised pool.
  // A client must not be able to submit arbitrary questions to harvest XP.
  // DEF-021: Restrict to single-select questions only (correctOptions must be null).
  const service = await prisma.awsService.findUnique({
    where: { code: boss.themeService },
    select: { id: true },
  });
  const poolWhere = service
    ? { active: true, awsServiceId: service.id, ...SINGLE_SELECT_FILTER }
    : { active: true, ...SINGLE_SELECT_FILTER };

  const authorisedPool = await prisma.studyQuestion.findMany({
    where: poolWhere,
    select: { id: true },
  });
  const authorisedIds = new Set(authorisedPool.map((q) => q.id));

  // Only score answers whose IDs are in the authorised pool.
  const validatedAnswers = body.answers.filter((a) => authorisedIds.has(a.questionId));

  const submittedIds = validatedAnswers.map((a) => a.questionId);
  const questions = await prisma.studyQuestion.findMany({
    where: { id: { in: submittedIds }, active: true, ...SINGLE_SELECT_FILTER },
    select: {
      id: true,
      correctOption: true,
      topic: true,
      difficulty: true,
      statement: true,
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
      cachedExplainSummary: true,
    },
  });

  const questionMap = new Map(questions.map((q) => [q.id, q]));
  const weights = await listXpWeightsByActivity(BOSS_BATTLE_ACTIVITY);

  // Process answers in order: each correct answer extends the streak and its damage
  // multiplier (damageMultiplier); a miss resets the streak. Damage is no longer a flat
  // rate, so correctCount/totalAnswered/streak are persisted on BossBattle instead of
  // being reconstructed from HP deltas (previously DEF-020).
  let streak = battle.streak;
  let roundDamage = 0;
  let roundCorrect = 0;
  let roundXp = 0;
  const roundSnapshotEntries: BattleSnapshotEntry[] = [];
  for (const answer of validatedAnswers) {
    const question = questionMap.get(answer.questionId);
    if (!question) continue;
    const optionLetter = LETTERS[answer.selectedOption];
    const isCorrect = Boolean(optionLetter) && question.correctOption.toUpperCase() === optionLetter;

    roundSnapshotEntries.push(toSnapshotEntry(question, optionLetter ?? "A"));

    if (!isCorrect) {
      streak = 0;
      continue;
    }

    streak += 1;
    roundCorrect += 1;
    roundDamage += boss.damagePerCorrect * damageMultiplier(streak);

    const difficulty = (question.difficulty ?? "medium") as "easy" | "medium" | "hard";
    const topic = question.topic ?? "*";
    const baseXp = Math.max(20, Math.round(getTaskXpByDifficulty(difficulty) / 3));
    const weight = resolveXpWeight(weights, { activityType: BOSS_BATTLE_ACTIVITY, topic, difficulty });
    roundXp += applyWeightedXp(baseXp, weight);
  }

  const newHp = Math.max(0, battle.remainingHp - roundDamage);
  const victory = newHp <= 0;
  const correctCount = battle.correctCount + roundCorrect;
  const totalAnswered = battle.totalAnswered + validatedAnswers.length;
  const gainedXp = battle.gainedXp + roundXp + (victory ? 50 : 0);
  const existingSnapshot = Array.isArray(battle.answersSnapshot)
    ? (battle.answersSnapshot as unknown as BattleSnapshotEntry[])
    : [];
  const answersSnapshot = [...existingSnapshot, ...roundSnapshotEntries];

  let newAchievements: { code: string; name: string }[] = [];

  await prisma.bossBattle.update({
    where: { id: battle.id },
    data: {
      remainingHp: newHp,
      streak: victory ? 0 : streak,
      correctCount,
      totalAnswered,
      gainedXp,
      victory,
      answersSnapshot,
      ...(victory ? { finishedAt: new Date() } : {}),
    },
  });

  if (victory) {
    const since = new Date();

    // Award XP via StudySessionHistory so leaderboard/achievements see it.
    await prisma.studySessionHistory.create({
      data: {
        userId: user.id,
        sessionType: "KC",
        title: `Boss Battle: ${boss.name}`,
        gainedXp,
        scorePercent: totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 100,
        correctAnswers: correctCount,
        totalQuestions: totalAnswered,
        answersSnapshot,
        completedAt: new Date(),
      },
    });

    [newAchievements] = await Promise.all([
      syncAndGetNewAchievements(user.id, since),
      cacheDel(
        CACHE_KEYS.userStudyHistory(user.id),
        CACHE_KEYS.userPublicProfile(user.id),
        CACHE_KEYS.userAchievements(user.id),
        CACHE_KEYS.leaderboard(),
      ),
      recordStudyActivity(user.id, "questions", totalAnswered),
    ]);
    void publishLeaderboardUpdatedEvent({ userId: user.id, source: "KC", gainedXp });
  }

  return NextResponse.json({
    remainingHp: newHp,
    damage: roundDamage,
    correct: roundCorrect > 0,
    streak: victory ? 0 : streak,
    victory,
    ...(victory ? { gainedXp, newAchievements } : {}),
  });
}
