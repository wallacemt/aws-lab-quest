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

type PostBody = {
  bossId: string;
  answers: AnswerItem[];
};

const BOSS_BATTLE_ACTIVITY = "boss_battle" as const;

// DEF-021: filter expression that restricts to single-select questions only.
// For nullable Json columns, the WHERE IS NULL predicate uses { equals: Prisma.DbNull }.
const SINGLE_SELECT_FILTER = { correctOptions: { equals: Prisma.DbNull } };

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
    select: { id: true, correctOption: true, topic: true, difficulty: true },
  });

  const questionMap = new Map(questions.map((q) => [q.id, q]));

  let correctCount = 0;
  for (const answer of validatedAnswers) {
    const question = questionMap.get(answer.questionId);
    if (!question) continue;
    const optionLetter = ["A", "B", "C", "D", "E"][answer.selectedOption];
    if (optionLetter && question.correctOption.toUpperCase() === optionLetter) {
      correctCount++;
    }
  }

  const totalDamage = correctCount * boss.damagePerCorrect;
  const newHp = Math.max(0, battle.remainingHp - totalDamage);
  const victory = newHp <= 0;

  let gainedXp = 0;
  let newAchievements: { code: string; name: string }[] = [];

  if (victory) {
    // DEF-020: Compute XP and history from the whole battle, not only this submission.
    // Derive the accumulated correct answers from total HP damage across all submissions:
    //   correct answers in prior rounds = (boss.maxHp - battle.remainingHp) / damagePerCorrect
    //   correct answers this round       = correctCount
    const priorCorrect = Math.round((boss.maxHp - battle.remainingHp) / boss.damagePerCorrect);
    const totalCorrect = priorCorrect + correctCount;

    // Total questions seen across the whole battle: one per round of 5, inferred from HP.
    // We use the XP computation only over the known question metadata for this round;
    // prior rounds' exact questions are not stored. As a pragmatic approximation that
    // avoids a schema migration, we award per-question XP for the current batch only
    // and apply a multiplier for prior correct answers using the average base XP.
    const weights = await listXpWeightsByActivity(BOSS_BATTLE_ACTIVITY);

    // XP for correctly-answered questions in THIS submission (with full metadata).
    gainedXp = questions.reduce((total, question) => {
      const answer = validatedAnswers.find((a) => a.questionId === question.id);
      if (!answer) return total;
      const optionLetter = ["A", "B", "C", "D", "E"][answer.selectedOption];
      if (!optionLetter || question.correctOption.toUpperCase() !== optionLetter) return total;
      const difficulty = (question.difficulty ?? "medium") as "easy" | "medium" | "hard";
      const topic = question.topic ?? "*";
      const baseXp = Math.max(20, Math.round(getTaskXpByDifficulty(difficulty) / 3));
      const weight = resolveXpWeight(weights, { activityType: BOSS_BATTLE_ACTIVITY, topic, difficulty });
      return total + applyWeightedXp(baseXp, weight);
    }, 0);

    // XP for prior correct answers: use a flat base since we don't have their metadata.
    const defaultBase = Math.max(20, Math.round(getTaskXpByDifficulty("medium") / 3));
    gainedXp += priorCorrect * defaultBase;

    // Flat victory bonus.
    gainedXp += 50;

    // totalAnswered: prior rounds' correct answers (derived from HP) + this round's submitted
    // answers. Because each correct answer dealt 1 unit of damage, priorCorrect is exact;
    // we can't know prior incorrect answers without a schema change, so we conservatively
    // count only what we can verify: all valid answers in this final round plus prior corrects.
    const totalAnswered = priorCorrect + validatedAnswers.length;

    const since = new Date();
    await prisma.bossBattle.update({
      where: { id: battle.id },
      data: {
        remainingHp: 0,
        victory: true,
        gainedXp,
        finishedAt: new Date(),
      },
    });

    // Award XP via StudySessionHistory so leaderboard/achievements see it.
    // Reflect the full battle's totals (DEF-020).
    await prisma.studySessionHistory.create({
      data: {
        userId: user.id,
        sessionType: "KC",
        title: `Boss Battle: ${boss.name}`,
        gainedXp,
        scorePercent: totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 100,
        correctAnswers: totalCorrect,
        totalQuestions: totalAnswered,
        answersSnapshot: validatedAnswers,
        completedAt: new Date(),
      },
    });

    newAchievements = await syncAndGetNewAchievements(user.id, since);
  } else {
    await prisma.bossBattle.update({
      where: { id: battle.id },
      data: { remainingHp: newHp },
    });
  }

  return NextResponse.json({
    remainingHp: newHp,
    victory,
    ...(victory ? { gainedXp, newAchievements } : {}),
  });
}
