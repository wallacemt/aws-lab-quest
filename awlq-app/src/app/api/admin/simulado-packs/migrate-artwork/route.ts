import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import {
  deleteArtworkFromSupabase,
  isDataUrl,
  uploadArtworkDataUrl,
} from "@/lib/simulado-pack-artwork";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

type MigrateBody = {
  limit?: number;
  dryRun?: boolean;
};

type MigrationResult = {
  id: string;
  name: string;
  ok: boolean;
  newUrl?: string;
  error?: string;
};

export async function GET(request: NextRequest) {
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;

  const pending = await prisma.simuladoPack.count({
    where: { artworkUrl: { startsWith: "data:" } },
  });

  return NextResponse.json({ pending, defaultLimit: DEFAULT_LIMIT, maxLimit: MAX_LIMIT });
}

export async function POST(request: NextRequest) {
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;

  const body = (await request.json().catch(() => ({}))) as Partial<MigrateBody>;
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, typeof body.limit === "number" ? Math.floor(body.limit) : DEFAULT_LIMIT),
  );
  const dryRun = Boolean(body.dryRun);

  const candidates = await prisma.simuladoPack.findMany({
    where: { artworkUrl: { startsWith: "data:" } },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true, name: true, artworkUrl: true },
  });

  const results: MigrationResult[] = [];
  let migrated = 0;
  let failed = 0;

  for (const pack of candidates) {
    if (!pack.artworkUrl || !isDataUrl(pack.artworkUrl)) {
      results.push({ id: pack.id, name: pack.name, ok: false, error: "Nao parece data URL valida." });
      failed += 1;
      continue;
    }

    if (dryRun) {
      results.push({ id: pack.id, name: pack.name, ok: true });
      continue;
    }

    let newUrl: string | null = null;
    try {
      newUrl = await uploadArtworkDataUrl(pack.artworkUrl, pack.id);
      await prisma.simuladoPack.update({
        where: { id: pack.id },
        data: { artworkUrl: newUrl },
      });
      results.push({ id: pack.id, name: pack.name, ok: true, newUrl });
      migrated += 1;
    } catch (err) {
      if (newUrl) {
        await deleteArtworkFromSupabase(newUrl).catch(() => undefined);
      }
      results.push({
        id: pack.id,
        name: pack.name,
        ok: false,
        error: err instanceof Error ? err.message : "Erro desconhecido.",
      });
      failed += 1;
    }
  }

  const remaining = await prisma.simuladoPack.count({
    where: { artworkUrl: { startsWith: "data:" } },
  });

  return NextResponse.json({
    processed: candidates.length,
    migrated,
    failed,
    remaining,
    dryRun,
    results,
  });
}
