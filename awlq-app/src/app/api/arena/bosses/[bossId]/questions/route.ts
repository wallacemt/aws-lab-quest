import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireApprovedUser } from "@/lib/user-auth";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ bossId: string }> };

/**
 * GET /api/arena/bosses/[bossId]/questions?count=5
 *
 * Returns questions filtered by the boss's themeService (AwsService.code),
 * scoped to the user's target certification when one is set (same as KC —
 * a boss themed on S3 shouldn't pull SAA questions for a Security+ user).
 * When the pool is short, enqueues background generation the same way KC
 * does (WorkerTrigger action "generate-kc" -> kcGenerationQueue), so a
 * thin pool self-heals for future battles instead of hard-failing.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireApprovedUser(request);
  if (auth.response) return auth.response;
  const { user } = auth;

  const { bossId } = await params;
  const countParam = request.nextUrl.searchParams.get("count");
  const count = Math.min(20, Math.max(1, parseInt(countParam ?? "5", 10)));

  const boss = await prisma.boss.findUnique({
    where: { id: bossId, active: true },
    select: { themeService: true },
  });

  if (!boss) {
    return NextResponse.json({ error: "Boss not found." }, { status: 404 });
  }

  const [service, profile] = await Promise.all([
    prisma.awsService.findUnique({ where: { code: boss.themeService }, select: { id: true } }),
    prisma.userProfile.findUnique({ where: { userId: user.id }, select: { certificationPresetId: true } }),
  ]);

  const where: Prisma.StudyQuestionWhereInput = {
    active: true,
    ...(service ? { awsServiceId: service.id } : {}),
    ...(profile?.certificationPresetId ? { certificationPresetId: profile.certificationPresetId } : {}),
  };

  const pool = await prisma.studyQuestion.findMany({
    where,
    select: {
      id: true,
      statement: true,
      optionA: true,
      optionB: true,
      optionC: true,
      optionD: true,
      optionE: true,
    },
    take: count * 5,
  });

  let generationRequestId: string | null = null;
  const gap = count - pool.length;

  if (gap > 0) {
    // Same backfill mechanism as KC (DEF-005): enqueue via WorkerTrigger rather
    // than pushing to the queue directly, and let the poller pick it up.
    generationRequestId = randomBytes(16).toString("hex");

    await prisma.workerTrigger.create({
      data: {
        action: "generate-kc",
        source: "arena_gap_fill",
        payload: {
          requestId: generationRequestId,
          userId: user.id,
          certificationPresetId: profile?.certificationPresetId ?? undefined,
          serviceCode: boss.themeService,
          difficulty: "medium",
          count: gap,
        },
      },
    });
  }

  if (pool.length === 0) {
    if (generationRequestId) {
      // Background generation was enqueued but nothing is available yet.
      return NextResponse.json({ questions: [], insufficient: true, generationRequestId });
    }
    return NextResponse.json({ error: "Nenhuma questao encontrada para este boss." }, { status: 404 });
  }

  const shuffled = pool.sort(() => Math.random() - 0.5).slice(0, count);

  return NextResponse.json({
    questions: shuffled,
    generationRequestId,
    insufficient: generationRequestId !== null,
  });
}
