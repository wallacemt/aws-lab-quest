import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ chainId: string }> };

type UnlockRule = {
  minScorePercent?: number;
  sessionType?: "KC" | "SIMULADO";
};

/**
 * POST /api/trails/[chainId]/progress
 *
 * Marks a stage as completed for the authenticated user.
 * Body: { stageId: string }
 *
 * Validates:
 *   1. Stage belongs to the specified chain.
 *   2. Stage is unlocked for this user (predecessor completed + unlockRule satisfied).
 *
 * Returns { unlockedNext?: string } with the id of the newly unlocked next stage,
 * if one exists.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { chainId } = await context.params;
  const body = (await request.json()) as { stageId?: string };

  if (!body.stageId) {
    return NextResponse.json({ error: "stageId is required" }, { status: 400 });
  }

  const userId = session.user.id;

  // Verify chain exists and is active
  const chain = await prisma.questChain.findUnique({
    where: { id: chainId, active: true },
    select: { id: true },
  });
  if (!chain) {
    return NextResponse.json({ error: "Chain not found" }, { status: 404 });
  }

  // Load the target stage and all stages in this chain (needed for unlock check)
  const [targetStage, allStages] = await Promise.all([
    prisma.questChainStage.findFirst({
      where: { id: body.stageId, chainId },
      select: { id: true, position: true, chainId: true, awsServiceId: true, topic: true, unlockRule: true },
    }),
    prisma.questChainStage.findMany({
      where: { chainId },
      orderBy: { position: "asc" },
      select: { id: true, position: true, awsServiceId: true, topic: true, unlockRule: true },
    }),
  ]);

  if (!targetStage) {
    return NextResponse.json({ error: "Stage not found in this chain" }, { status: 404 });
  }

  // Determine if target stage is unlocked for this user
  let isUnlocked = targetStage.position === 1;

  if (!isUnlocked) {
    const predecessor = allStages.find((s) => s.position === targetStage.position - 1);
    if (predecessor) {
      const predecessorProgress = await prisma.questChainProgress.findUnique({
        where: { userId_stageId: { userId, stageId: predecessor.id } },
        select: { completed: true },
      });

      const predecessorCompleted = predecessorProgress?.completed ?? false;

      if (predecessorCompleted) {
        isUnlocked = await satisfiesUnlockRule(predecessor, userId);
      }
    }
  }

  if (!isUnlocked) {
    return NextResponse.json({ error: "Stage is locked" }, { status: 403 });
  }

  // Upsert the completion record
  await prisma.questChainProgress.upsert({
    where: { userId_stageId: { userId, stageId: body.stageId } },
    create: {
      userId,
      stageId: body.stageId,
      completed: true,
      completedAt: new Date(),
    },
    update: {
      completed: true,
      completedAt: new Date(),
    },
  });

  // Determine which stage is now newly unlocked (the next one in the chain)
  const nextStage = allStages.find((s) => s.position === targetStage.position + 1);
  let unlockedNext: string | undefined;

  if (nextStage) {
    unlockedNext = nextStage.id;
  }

  return NextResponse.json({ unlockedNext });
}

/**
 * Checks whether a stage's unlockRule is satisfied by the user's session history.
 * Returns true if there is no rule or the rule conditions are met.
 */
async function satisfiesUnlockRule(
  stage: { awsServiceId: string | null; topic: string | null; unlockRule: unknown },
  userId: string,
): Promise<boolean> {
  if (!stage.unlockRule) return true;

  const rule = stage.unlockRule as UnlockRule;
  const minScore = rule.minScorePercent ?? 0;
  const requiredType = rule.sessionType;

  if (minScore === 0 && !requiredType) return true;

  const matchingSessions = await prisma.studySessionHistory.findFirst({
    where: {
      userId,
      anonymized: false,
      scorePercent: { gte: minScore },
      ...(requiredType ? { sessionType: requiredType } : {}),
    },
    select: { id: true },
  });

  return matchingSessions !== null;
}
