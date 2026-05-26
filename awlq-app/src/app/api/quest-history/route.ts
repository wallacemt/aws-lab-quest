import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { syncAndGetNewAchievements } from "@/lib/achievements";
import { cacheDel, cacheGetOrSet, CACHE_KEYS, CACHE_TTL } from "@/lib/cache";
import { getLevel, getTaskXpByDifficulty } from "@/lib/levels";
import { prisma } from "@/lib/prisma";
import { publishLeaderboardUpdatedEvent } from "@/lib/realtime-events";
import { Task } from "@/lib/types";
import { applyWeightedXp, listXpWeightsByActivity, resolveXpWeight } from "@/lib/xp-weights";

function normalizeTaskSnapshot(tasks: unknown): Task[] {
  if (!Array.isArray(tasks)) {
    return [];
  }

  return tasks
    .map((task, index) => {
      const candidate = (task ?? {}) as Partial<Task>;
      return {
        id: typeof candidate.id === "number" ? candidate.id : index + 1,
        title: String(candidate.title ?? `Missao ${index + 1}`),
        mission: String(candidate.mission ?? "Conclua esta etapa do laboratorio."),
        service: String(candidate.service ?? "AWS"),
        analogy: String(candidate.analogy ?? ""),
        steps: Array.isArray(candidate.steps) ? candidate.steps.map((step) => String(step)) : [],
        difficulty:
          candidate.difficulty === "easy" || candidate.difficulty === "medium" || candidate.difficulty === "hard"
            ? candidate.difficulty
            : "medium",
        completed: Boolean(candidate.completed),
      };
    })
    .slice(0, 20);
}

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const history = await cacheGetOrSet(
    CACHE_KEYS.userQuestHistory(session.user.id),
    () =>
      prisma.questHistory.findMany({
        where: { userId: session.user.id },
        orderBy: { completedAt: "desc" },
        take: 50,
      }),
    CACHE_TTL.USER_HISTORY,
  );

  return NextResponse.json({ history });
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    title?: string;
    theme?: string;
    xp?: number;
    tasksCount?: number;
    taskSnapshot?: unknown;
    sourceLabText?: string;
    completedAt?: string;
    certification?: string;
    userName?: string;
  };

  if (!body.title || !body.theme || !body.tasksCount || !body.completedAt) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const taskSnapshot = normalizeTaskSnapshot(body.taskSnapshot);
  const completedTasks = taskSnapshot.filter((task) => task.completed);
  const taskBase = completedTasks.length > 0 ? completedTasks : taskSnapshot;

  // LSF-2026-008: ignore client-supplied XP when no tasks are present; prevents
  // leaderboard manipulation via empty taskSnapshot + inflated xp field.
  // LSF-2026-014: tasksCount is capped to the normalizeTaskSnapshot limit (20).
  let computedXp = taskBase.length > 0 ? 0 : 0; // always recomputed below when tasks exist
  if (taskBase.length > 0) {
    const weights = await listXpWeightsByActivity("LAB");

    computedXp = taskBase.reduce((total, task) => {
      const difficulty = task.difficulty ?? "medium";
      const baseXp = getTaskXpByDifficulty(difficulty);
      const weight = resolveXpWeight(weights, {
        activityType: "LAB",
        topic: task.service,
        difficulty,
      });

      return total + applyWeightedXp(baseXp, weight);
    }, 0);
  }

  const item = await prisma.questHistory.create({
    data: {
      userId: session.user.id,
      title: body.title,
      theme: body.theme,
      xp: computedXp,
      tasksCount: Math.max(1, Math.min(20, Math.round(body.tasksCount))), // LSF-2026-014: cap range
      taskSnapshot,
      sourceLabText: body.sourceLabText ? String(body.sourceLabText).slice(0, 30000) : null,
      completedAt: new Date(body.completedAt),
      certification: body.certification ?? "",
      userName: body.userName ?? session.user.name,
    },
  });

  // Recalculate total XP and persist all earned badges up to current level.
  const totals = await prisma.questHistory.aggregate({
    where: { userId: session.user.id },
    _sum: { xp: true },
  });
  const totalXp = totals._sum.xp ?? 0;
  const currentLevel = getLevel(totalXp);

  const eligibleBadges = await prisma.levelBadge.findMany({
    where: { level: { lte: currentLevel.number } },
    select: { id: true },
  });

  if (eligibleBadges.length > 0) {
    await prisma.$transaction(
      eligibleBadges.map((badge) =>
        prisma.userBadge.upsert({
          where: {
            userId_badgeId: {
              userId: session.user.id,
              badgeId: badge.id,
            },
          },
          create: {
            userId: session.user.id,
            badgeId: badge.id,
          },
          update: {},
        }),
      ),
    );
  }

  const [prevQuestXp, prevStudyXp] = await Promise.all([
    prisma.questHistory.aggregate({ where: { userId: session.user.id, id: { not: item.id } }, _sum: { xp: true } }),
    prisma.studySessionHistory.aggregate({ where: { userId: session.user.id }, _sum: { gainedXp: true } }),
  ]);
  const prevXp = (prevQuestXp._sum.xp ?? 0) + (prevStudyXp._sum.gainedXp ?? 0);
  const newXp = prevXp + item.xp;
  const syncSince = new Date();

  void publishLeaderboardUpdatedEvent({
    userId: session.user.id,
    source: "LAB",
    gainedXp: item.xp,
  });

  const [newAchievements] = await Promise.all([
    syncAndGetNewAchievements(session.user.id, syncSince),
    cacheDel(
      CACHE_KEYS.userQuestHistory(session.user.id),
      CACHE_KEYS.userPublicProfile(session.user.id),
      CACHE_KEYS.userAchievements(session.user.id),
      CACHE_KEYS.leaderboard(),
    ),
  ]);

  return NextResponse.json({ item, prevXp, newXp, newAchievements }, { status: 201 });
}
