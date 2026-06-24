import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ chainId: string }> };

/**
 * PUT /api/admin/trails/[chainId]
 * Updates a QuestChain's mutable fields.
 * Body: { name?, description?, active?, displayOrder? }
 *
 * DELETE /api/admin/trails/[chainId]
 * Deletes a QuestChain (cascades to stages and progress).
 */

type UpdateChainBody = {
  name?: string;
  description?: string;
  active?: boolean;
  displayOrder?: number;
};

export async function PUT(request: NextRequest, context: RouteContext) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { chainId } = await context.params;
  const body = (await request.json()) as UpdateChainBody;

  const existing = await prisma.questChain.findUnique({ where: { id: chainId }, select: { id: true } });
  if (!existing) {
    return NextResponse.json({ error: "Chain not found" }, { status: 404 });
  }

  const chain = await prisma.questChain.update({
    where: { id: chainId },
    data: {
      ...(body.name !== undefined && { name: body.name.trim() }),
      ...(body.description !== undefined && { description: body.description?.trim() ?? null }),
      ...(body.active !== undefined && { active: body.active }),
      ...(body.displayOrder !== undefined && { displayOrder: body.displayOrder }),
    },
  });

  return NextResponse.json({ chain });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { chainId } = await context.params;

  const existing = await prisma.questChain.findUnique({ where: { id: chainId }, select: { id: true } });
  if (!existing) {
    return NextResponse.json({ error: "Chain not found" }, { status: 404 });
  }

  await prisma.questChain.delete({ where: { id: chainId } });

  return NextResponse.json({ deleted: true });
}
