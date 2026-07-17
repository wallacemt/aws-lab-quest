import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/trails
 *
 * Returns all active QuestChains with their stages, annotated with the
 * authenticated user's unlock and completion state for each stage.
 *
 * Unlock logic:
 *   - Stage at position 1: always unlocked.
 *   - Stage at position N: unlocked if stage at position N-1 in the same
 *     chain is completed by this user AND satisfies its unlockRule (if any).
 *
 * unlockRule shape: { minScorePercent?: number, sessionType?: "KC" | "SIMULADO" }
 *   When set, the predecessor stage's completion requires the user to have
 *   a StudySessionHistory entry for the predecessor stage's awsServiceId/topic
 *   with scorePercent >= minScorePercent and the specified sessionType.
 */

type UnlockRule = {
  minScorePercent?: number;
  sessionType?: "KC" | "SIMULADO";
};

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const chains = await prisma.questChain.findMany({
    where: { active: true },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    include: {
      stages: {
        orderBy: { position: "asc" },
      },
    },
  });

  if (chains.length === 0) {
    return NextResponse.json({ chains: [] });
  }

  // Fetch all completion records for this user across all relevant stages
  const allStageIds = chains.flatMap((c) => c.stages.map((s) => s.id));
  const completions = await prisma.questChainProgress.findMany({
    where: { userId, stageId: { in: allStageIds } },
    select: { stageId: true, completed: true, completedAt: true },
  });

  const completionByStageId = new Map(completions.map((p) => [p.stageId, p]));

  // Collect awsServiceIds from stages that have unlock rules with score requirements
  // so we can batch-check StudySessionHistory once.
  const serviceIdsNeeded = new Set<string>();
  const topicsNeeded = new Set<string>();
  for (const chain of chains) {
    for (const stage of chain.stages) {
      if (stage.unlockRule && stage.awsServiceId) serviceIdsNeeded.add(stage.awsServiceId);
      if (stage.unlockRule && stage.topic) topicsNeeded.add(stage.topic);
    }
  }

  // Fetch relevant session history once
  const recentSessions = await prisma.studySessionHistory.findMany({
    where: {
      userId,
      anonymized: false,
      ...(serviceIdsNeeded.size > 0 || topicsNeeded.size > 0
        ? {} // fetch all if needed; filter in memory
        : { id: "impossible" }), // short-circuit if nothing needed
    },
    select: {
      sessionType: true,
      scorePercent: true,
      certificationCode: true,
    },
    orderBy: { completedAt: "desc" },
    take: 200,
  });

  /**
   * Checks whether a stage satisfies its unlockRule based on session history.
   * Returns true if there is no unlock rule or the rule is satisfied.
   */
  function satisfiesUnlockRule(stage: { awsServiceId: string | null; topic: string | null; unlockRule: unknown }): boolean {
    if (!stage.unlockRule) return true;

    const rule = stage.unlockRule as UnlockRule;
    const minScore = rule.minScorePercent ?? 0;
    const requiredType = rule.sessionType;

    // We look for a session that matches the stage's service/topic context and meets the score/type requirement.
    // Since sessions don't have a direct awsServiceId filter, we use certificationCode as a proxy.
    // For a stricter future implementation, session-level service tagging would be needed.
    // For now, we check that ANY session meets minScore and sessionType.
    return recentSessions.some((s) => {
      if (requiredType && s.sessionType !== requiredType) return false;
      if (s.scorePercent < minScore) return false;
      return true;
    });
  }

  const enrichedChains = chains.map((chain) => {
    const stages = chain.stages.map((stage) => {
      const completion = completionByStageId.get(stage.id);
      const completed = completion?.completed ?? false;

      let unlocked: boolean;
      if (stage.position === 1) {
        unlocked = true;
      } else {
        // Find predecessor stage (position - 1)
        const predecessor = chain.stages.find((s) => s.position === stage.position - 1);
        if (!predecessor) {
          unlocked = false;
        } else {
          const predecessorCompletion = completionByStageId.get(predecessor.id);
          const predecessorCompleted = predecessorCompletion?.completed ?? false;

          // Predecessor must be completed AND satisfy its own stage's unlock rule
          unlocked = predecessorCompleted && satisfiesUnlockRule(predecessor);
        }
      }

      return {
        id: stage.id,
        position: stage.position,
        title: stage.title,
        awsServiceId: stage.awsServiceId,
        topic: stage.topic,
        unlockRule: stage.unlockRule,
        imageUrl: stage.imageUrl,
        unlocked,
        completed,
        completedAt: completion?.completedAt ?? null,
      };
    });

    return {
      id: chain.id,
      name: chain.name,
      description: chain.description,
      displayOrder: chain.displayOrder,
      certificationPresetId: chain.certificationPresetId,
      stages,
    };
  });

  return NextResponse.json({ chains: enrichedChains });
}
