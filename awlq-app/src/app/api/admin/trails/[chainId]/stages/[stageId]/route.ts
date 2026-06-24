import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ chainId: string; stageId: string }> };

/**
 * PUT /api/admin/trails/[chainId]/stages/[stageId]
 * Updates a stage's mutable fields.
 * Body: { title?, position?, awsServiceId?, topic?, unlockRule? }
 *
 * DELETE /api/admin/trails/[chainId]/stages/[stageId]
 * Deletes a stage (cascades to progress rows for that stage).
 */

type UpdateStageBody = {
  title?: string;
  position?: number;
  awsServiceId?: string | null;
  topic?: string | null;
  unlockRule?: Record<string, unknown> | null;
};

export async function PUT(request: NextRequest, context: RouteContext) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { chainId, stageId } = await context.params;
  const body = (await request.json()) as UpdateStageBody;

  const existing = await prisma.questChainStage.findFirst({
    where: { id: stageId, chainId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Stage not found" }, { status: 404 });
  }

  // Build update data imperatively to satisfy Prisma's InputJsonValue constraint
  // on the nullable JSON unlockRule field.
  const data: Prisma.QuestChainStageUpdateInput = {};
  if (body.title !== undefined) data.title = body.title.trim();
  if (body.position !== undefined) data.position = body.position;
  if (body.awsServiceId !== undefined) data.awsServiceId = body.awsServiceId;
  if (body.topic !== undefined) data.topic = body.topic?.trim() ?? null;
  if (body.unlockRule !== undefined) {
    data.unlockRule = body.unlockRule === null ? Prisma.JsonNull : (body.unlockRule as Prisma.InputJsonValue);
  }

  try {
    const stage = await prisma.questChainStage.update({ where: { id: stageId }, data });
    return NextResponse.json({ stage });
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
    console.error("PUT /api/admin/trails/[chainId]/stages/[stageId] error:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { chainId, stageId } = await context.params;

  const existing = await prisma.questChainStage.findFirst({
    where: { id: stageId, chainId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Stage not found" }, { status: 404 });
  }

  await prisma.questChainStage.delete({ where: { id: stageId } });

  return NextResponse.json({ deleted: true });
}
