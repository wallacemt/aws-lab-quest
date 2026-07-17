import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ chainId: string }> };

/**
 * GET /api/admin/trails/[chainId]/stages
 * Lists all stages for a chain, ordered by position.
 *
 * POST /api/admin/trails/[chainId]/stages
 * Creates a new stage in the chain.
 * Body: { title, position, awsServiceId?, topic?, unlockRule? }
 */

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { chainId } = await context.params;

  const chain = await prisma.questChain.findUnique({ where: { id: chainId }, select: { id: true } });
  if (!chain) {
    return NextResponse.json({ error: "Chain not found" }, { status: 404 });
  }

  const stages = await prisma.questChainStage.findMany({
    where: { chainId },
    orderBy: { position: "asc" },
  });

  return NextResponse.json({ stages });
}

type CreateStageBody = {
  title?: string;
  position?: number;
  awsServiceId?: string;
  topic?: string;
  unlockRule?: Record<string, unknown>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { chainId } = await context.params;
  const body = (await request.json()) as CreateStageBody;

  if (!body.title || body.title.trim().length === 0) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  if (typeof body.position !== "number") {
    return NextResponse.json({ error: "position is required" }, { status: 400 });
  }

  const chain = await prisma.questChain.findUnique({ where: { id: chainId }, select: { id: true } });
  if (!chain) {
    return NextResponse.json({ error: "Chain not found" }, { status: 404 });
  }

  try {
    const stage = await prisma.questChainStage.create({
      data: {
        chainId,
        title: body.title.trim(),
        position: body.position,
        awsServiceId: body.awsServiceId ?? null,
        topic: body.topic?.trim() ?? null,
        unlockRule: body.unlockRule != null ? (body.unlockRule as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });

    // Fire-and-forget via WorkerTrigger — illustration is generated in the
    // background and cached on the stage once ready (issue #34).
    await prisma.workerTrigger.create({
      data: {
        action: "generate-trail-illustration",
        source: "trail_stage_create",
        payload: { stageId: stage.id },
      },
    });

    return NextResponse.json({ stage }, { status: 201 });
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Já existe um stage nessa posição nesta trilha." },
        { status: 409 },
      );
    }
    console.error("POST /api/admin/trails/[chainId]/stages error:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
