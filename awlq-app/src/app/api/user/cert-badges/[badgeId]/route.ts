import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const SELECT = {
  id: true,
  badgeUrl: true,
  badgeImageUrl: true,
  earnedAt: true,
  certificationPreset: { select: { code: true, name: true } },
} as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ badgeId: string }> },
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { badgeId } = await params;

  const existing = await prisma.userCertBadge.findUnique({ where: { id: badgeId }, select: { userId: true } });
  if (!existing) return NextResponse.json({ error: "Badge not found." }, { status: 404 });
  if (existing.userId !== session.user.id) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const body = (await request.json()) as {
    badgeUrl?: string;
    certificationPresetId?: string | null;
    badgeImageUrl?: string | null;
    removeImage?: boolean;
  };

  const data: Record<string, unknown> = {};

  if (typeof body.badgeUrl === "string") {
    const trimmed = body.badgeUrl.trim();
    if (!trimmed) return NextResponse.json({ error: "badgeUrl nao pode ser vazio." }, { status: 400 });
    try { new URL(trimmed); } catch { return NextResponse.json({ error: "badgeUrl invalido." }, { status: 400 }); }
    data.badgeUrl = trimmed;
  }

  if ("certificationPresetId" in body) {
    data.certificationPresetId = body.certificationPresetId ?? null;
  }

  if (body.removeImage) {
    data.badgeImageUrl = null;
  } else if (typeof body.badgeImageUrl === "string" && body.badgeImageUrl.trim()) {
    data.badgeImageUrl = body.badgeImageUrl.trim();
  }

  const badge = await prisma.userCertBadge.update({ where: { id: badgeId }, data, select: SELECT });

  return NextResponse.json({ badge });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ badgeId: string }> },
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { badgeId } = await params;

  const existing = await prisma.userCertBadge.findUnique({ where: { id: badgeId }, select: { userId: true } });
  if (!existing) return NextResponse.json({ error: "Badge not found." }, { status: 404 });
  if (existing.userId !== session.user.id) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  await prisma.userCertBadge.delete({ where: { id: badgeId } });

  return NextResponse.json({ ok: true });
}
