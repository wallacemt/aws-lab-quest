import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { deleteArtworkFromSupabase, resolveArtworkForStorage } from "@/lib/simulado-pack-artwork";

export async function GET(request: NextRequest) {
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;

  const { searchParams } = new URL(request.url);
  const certificationCode = searchParams.get("certificationCode") ?? undefined;
  const activeParam = searchParams.get("active");
  const active = activeParam === "true" ? true : activeParam === "false" ? false : undefined;
  const search = searchParams.get("search")?.trim() ?? "";
  const sortByRaw = searchParams.get("sortBy") ?? "createdAt";
  const sortBy = ["createdAt", "name", "difficultyScore", "questionCount"].includes(sortByRaw)
    ? sortByRaw
    : "createdAt";
  const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";
  const minDiffScore = parseInt(searchParams.get("minDifficultyScore") ?? "0", 10);
  const maxDiffScore = parseInt(searchParams.get("maxDifficultyScore") ?? "10", 10);
  const hasSessions = searchParams.get("hasSessions");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10)));

  const where: NonNullable<Parameters<typeof prisma.simuladoPack.findMany>[0]>["where"] = {
    ...(certificationCode ? { certificationPreset: { code: certificationCode } } : {}),
    ...(active !== undefined ? { active } : {}),
    ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
    ...((minDiffScore > 1 || maxDiffScore < 10) ? { difficultyScore: { gte: minDiffScore, lte: maxDiffScore } } : {}),
  };

  const orderBy: NonNullable<Parameters<typeof prisma.simuladoPack.findMany>[0]>["orderBy"] =
    sortBy === "questionCount"
      ? { questions: { _count: sortOrder } }
      : { [sortBy]: sortOrder };

  const [total, packs] = await Promise.all([
    prisma.simuladoPack.count({ where }),
    prisma.simuladoPack.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        certificationPreset: { select: { code: true, name: true } },
        createdBy: { select: { name: true, email: true } },
        _count: { select: { sessions: true, questions: true } },
      },
    }),
  ]);

  let items = packs.map((p) => ({
    id: p.id,
    name: p.name,
    certificationCode: p.certificationPreset?.code ?? null,
    certificationName: p.certificationPreset?.name ?? null,
    questionCount: p._count.questions,
    difficultyScore: p.difficultyScore,
    active: p.active,
    artworkUrl: p.artworkUrl ?? null,
    createdAt: p.createdAt.toISOString(),
    createdByName: p.createdBy?.name ?? null,
    sessionCount: p._count.sessions,
  }));

  if (hasSessions === "true") items = items.filter((i) => i.sessionCount > 0);
  if (hasSessions === "false") items = items.filter((i) => i.sessionCount === 0);

  return NextResponse.json({ items, total, page, pageSize });
}

type CreateBody = {
  name: string;
  certificationCode: string;
  questionIds: string[];
  artworkUrl?: string;
  difficultyScore?: number;
};

export async function POST(request: NextRequest) {
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;

  const body = (await request.json().catch(() => ({}))) as Partial<CreateBody>;
  const name = body.name?.trim();
  const certificationCode = body.certificationCode?.trim();
  const questionIds = Array.isArray(body.questionIds) ? (body.questionIds as string[]) : [];

  if (!name || !certificationCode) {
    return NextResponse.json({ error: "name e certificationCode obrigatorios" }, { status: 400 });
  }
  if (questionIds.length < 20 || questionIds.length > 65) {
    return NextResponse.json({ error: "O pack deve ter entre 20 e 65 questoes" }, { status: 400 });
  }

  const certPreset = await prisma.certificationPreset.findUnique({
    where: { code: certificationCode },
    select: { id: true },
  });
  if (!certPreset) {
    return NextResponse.json({ error: "Certificacao nao encontrada" }, { status: 404 });
  }

  const difficultyScore = Math.min(10, Math.max(1, typeof body.difficultyScore === "number" ? body.difficultyScore : 1));

  let storedArtworkUrl: string | null = null;
  try {
    storedArtworkUrl = await resolveArtworkForStorage(body.artworkUrl ?? null);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha ao processar arte do pack" },
      { status: 502 },
    );
  }

  const finalArtworkUrl = storedArtworkUrl
    ?? "https://djitwkagdqgbhanenonk.supabase.co/storage/v1/object/public/aws-lab-quest/cert-badges/527007c2-c79f-4240-8a20-4b502c2f5b04.png";

  try {
    const pack = await prisma.simuladoPack.create({
      data: {
        name,
        certificationPresetId: certPreset.id,
        createdByUserId: adminResult.userId,
        questionCount: questionIds.length,
        difficultyScore,
        active: true,
        artworkUrl: finalArtworkUrl,
        questions: {
          create: questionIds.map((questionId, position) => ({ questionId, position })),
        },
      },
      select: { id: true, name: true, questionCount: true, difficultyScore: true, artworkUrl: true },
    });

    return NextResponse.json(pack, { status: 201 });
  } catch (err) {
    if (storedArtworkUrl) {
      await deleteArtworkFromSupabase(storedArtworkUrl).catch(() => undefined);
    }
    throw err;
  }
}
