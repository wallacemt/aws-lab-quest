import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ packId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;

  const { packId } = await params;
  const body = (await request.json().catch(() => ({}))) as { active?: boolean };

  const pack = await prisma.simuladoPack.findUnique({ where: { id: packId }, select: { id: true } });
  if (!pack) return NextResponse.json({ error: "Pack nao encontrado" }, { status: 404 });

  const updated = await prisma.simuladoPack.update({
    where: { id: packId },
    data: { ...(body.active !== undefined ? { active: body.active } : {}) },
    select: { id: true, name: true, active: true },
  });

  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;

  const { packId } = await params;
  const pack = await prisma.simuladoPack.findUnique({
    where: { id: packId },
    select: { id: true, _count: { select: { sessions: true } } },
  });
  if (!pack) return NextResponse.json({ error: "Pack nao encontrado" }, { status: 404 });

  if (pack._count.sessions > 0) {
    await prisma.simuladoPack.update({ where: { id: packId }, data: { active: false } });
    return NextResponse.json({ deleted: false, deactivated: true });
  }

  await prisma.simuladoPack.delete({ where: { id: packId } });
  return NextResponse.json({ deleted: true });
}
