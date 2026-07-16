import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { isAllowedArtworkUrl } from "@/lib/url-validation";
import { resolveBossArtworkForStorage } from "@/lib/boss-artwork";

/**
 * GET /api/admin/arena/bosses — list all bosses
 * POST /api/admin/arena/bosses — create a boss
 */

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const bosses = await prisma.boss.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ bosses });
}

type CreateBossBody = {
  name: string;
  code: string;
  themeService: string;
  maxHp: number;
  damagePerCorrect?: number;
  artworkUrl?: string;
  active?: boolean;
};

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  let body: CreateBossBody;
  try {
    body = (await request.json()) as CreateBossBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.name || !body.code || !body.themeService || !body.maxHp) {
    return NextResponse.json({ error: "name, code, themeService, and maxHp are required." }, { status: 400 });
  }

  // Data URLs (from AI generation or drag-drop upload) are uploaded to Supabase first,
  // so the SSRF check below only ever sees a real public HTTP/HTTPS URL.
  let artworkUrl: string | null;
  try {
    artworkUrl = await resolveBossArtworkForStorage(body.artworkUrl ?? null);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao salvar a arte do boss.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // LSF-2026-009: validate artworkUrl to prevent SSRF via the stored URL.
  if (artworkUrl !== null && !isAllowedArtworkUrl(artworkUrl)) {
    return NextResponse.json(
      { error: "artworkUrl must be a valid public HTTP/HTTPS URL." },
      { status: 400 },
    );
  }

  const boss = await prisma.boss.create({
    data: {
      name: body.name,
      code: body.code,
      themeService: body.themeService,
      maxHp: body.maxHp,
      damagePerCorrect: body.damagePerCorrect ?? 10,
      artworkUrl,
      active: body.active ?? true,
    },
  });

  return NextResponse.json({ boss }, { status: 201 });
}
