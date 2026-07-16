import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { isAllowedArtworkUrl } from "@/lib/url-validation";
import { deleteBossArtworkFromSupabase, resolveBossArtworkForStorage } from "@/lib/boss-artwork";

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

  if (body.artworkUrl !== undefined) {
    // Data URLs (from AI generation or drag-drop upload) are uploaded to Supabase first,
    // so the SSRF check below only ever sees a real public HTTP/HTTPS URL.
    let resolvedArtworkUrl: string | null;
    try {
      resolvedArtworkUrl = await resolveBossArtworkForStorage(body.artworkUrl);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao salvar a arte do boss.";
      return NextResponse.json({ error: message }, { status: 502 });
    }

    // LSF-2026-009: validate artworkUrl to prevent SSRF via the stored URL.
    if (resolvedArtworkUrl !== null && !isAllowedArtworkUrl(resolvedArtworkUrl)) {
      return NextResponse.json(
        { error: "artworkUrl must be a valid public HTTP/HTTPS URL." },
        { status: 400 },
      );
    }

    if (resolvedArtworkUrl !== body.artworkUrl) {
      const existing = await prisma.boss.findUnique({ where: { id: bossId }, select: { artworkUrl: true } });
      if (existing?.artworkUrl && existing.artworkUrl !== resolvedArtworkUrl) {
        await deleteBossArtworkFromSupabase(existing.artworkUrl).catch(() => undefined);
      }
    }

    body.artworkUrl = resolvedArtworkUrl;
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
  const boss = await prisma.boss.delete({ where: { id: bossId } });
  await deleteBossArtworkFromSupabase(boss.artworkUrl).catch(() => undefined);

  return NextResponse.json({ ok: true });
}
