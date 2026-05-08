import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { syncUserAchievements } from "@/lib/achievements";
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

  const history = await prisma.questHistory.findMany({
    where: { userId: session.user.id },
    orderBy: { completedAt: "desc" },
    take: 50,
  });

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

  let computedXp = Math.max(0, Math.round(body.xp ?? 0));
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
      tasksCount: body.tasksCount,
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

  void publishLeaderboardUpdatedEvent({
    userId: session.user.id,
    source: "LAB",
    gainedXp: item.xp,
  });
  void syncUserAchievements(session.user.id);

  return NextResponse.json({ item }, { status: 201 });
}
