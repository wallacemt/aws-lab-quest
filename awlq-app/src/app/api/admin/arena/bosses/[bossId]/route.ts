import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { isAllowedArtworkUrl } from "@/lib/url-validation";

type RouteParams = { params: Promise<{ bossId: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { bossId } = await params;
  const boss = await prisma.boss.findUnique({ where: { id: bossId } });
  if (!boss) return NextResponse.json({ error: "Boss not found." }, { status: 404 });

  return NextResponse.json({ boss });
}

type UpdateBossBody = Partial<{
  name: string;
  code: string;
  themeService: string;
  maxHp: number;
  damagePerCorrect: number;
  artworkUrl: string | null;
  active: boolean;
}>;

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { bossId } = await params;

  let body: UpdateBossBody;
  try {
    body = (await request.json()) as UpdateBossBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // LSF-2026-009: validate artworkUrl to prevent SSRF via the stored URL.
  if (body.artworkUrl !== undefined && body.artworkUrl !== null && !isAllowedArtworkUrl(body.artworkUrl)) {
    return NextResponse.json(
      { error: "artworkUrl must be a valid public HTTP/HTTPS URL." },
      { status: 400 },
    );
  }

  const boss = await prisma.boss.update({
    where: { id: bossId },
    data: body,
  });

  return NextResponse.json({ boss });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { bossId } = await params;
  await prisma.boss.delete({ where: { id: bossId } });

  return NextResponse.json({ ok: true });
}
