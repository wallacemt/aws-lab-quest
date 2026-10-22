import { validateQuestionImport, MAX_IMPORT_BYTES, type ImportItem } from "@/lib/question-import";
import { prepareQuestionImport } from "@/lib/question-import-server";
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
    isSkillBuilder: p.isSkillBuilder,
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
  questions?: ImportItem[];
  isSkillBuilder?: boolean;
  artworkUrl?: string;
  difficultyScore?: number;
};

export async function POST(request: NextRequest) {
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;

  const source = await request.text();
  if (new TextEncoder().encode(source).length > MAX_IMPORT_BYTES) return NextResponse.json({ error: "Payload excede 2 MB" }, { status: 413 });
  let body: Partial<CreateBody>;
  try { body = JSON.parse(source); } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const certificationCode = typeof body.certificationCode === "string" ? body.certificationCode.trim() : "";
  if ((body.isSkillBuilder !== undefined && typeof body.isSkillBuilder !== "boolean") ||
      (body.artworkUrl !== undefined && typeof body.artworkUrl !== "string") ||
      (body.difficultyScore !== undefined && (typeof body.difficultyScore !== "number" || !Number.isFinite(body.difficultyScore))))
    return NextResponse.json({ error: "Dados do pack inválidos" }, { status: 400 });
  let imported: ImportItem[] | undefined;
  try { if (body.questions !== undefined) imported = validateQuestionImport(body.questions); }
  catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 422 }); }
  const questionIds = Array.isArray(body.questionIds) ? (body.questionIds as string[]) : [];

  if (!name || !certificationCode) {
    return NextResponse.json({ error: "name e certificationCode obrigatorios" }, { status: 400 });
  }
  if ((imported && questionIds.length) || questionIds.some(id => typeof id !== "string" || !id) || new Set(questionIds).size !== questionIds.length) {
    return NextResponse.json({ error: "Use apenas o arquivo JSON ou IDs únicos do banco" }, { status: 400 });
  }
  const questionCount = imported?.length ?? questionIds.length;
  if (questionCount < 20 || questionCount > 65) {
    return NextResponse.json({ error: "O pack deve ter entre 20 e 65 questoes" }, { status: 400 });
  }

  const certPreset = await prisma.certificationPreset.findUnique({
    where: { code: certificationCode },
    select: { id: true },
  });
  if (!certPreset) {
    return NextResponse.json({ error: "Certificacao nao encontrada" }, { status: 404 });
  }

  if (!imported) {
    const valid = await prisma.studyQuestion.count({ where: { id: { in: questionIds }, certificationPresetId: certPreset.id, active: true } });
    if (valid !== questionIds.length) return NextResponse.json({ error: "Questões inválidas para esta certificação" }, { status: 422 });
  }
  const prepared = imported ? await prepareQuestionImport(imported.map(q => ({ ...q, certificationCode })), certificationCode) : null;

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
    const pack = await prisma.$transaction(async tx => {
      const ids = prepared ? await prepared.create(tx, certPreset.id) : questionIds;
      return tx.simuladoPack.create({
        data: {
          name,
          certificationPresetId: certPreset.id,
          createdByUserId: adminResult.userId,
          questionCount,
          isSkillBuilder: body.isSkillBuilder ?? false,
          difficultyScore,
          active: true,
          artworkUrl: finalArtworkUrl,
          questions: {
            create: ids.map((questionId, position) => ({ questionId, position })),
          },
        },
        select: { id: true, name: true, questionCount: true, difficultyScore: true, artworkUrl: true },
      });
    }, { timeout: 30000 });

    return NextResponse.json(pack, { status: 201 });
  } catch (err) {
    if (storedArtworkUrl) {
      await deleteArtworkFromSupabase(storedArtworkUrl).catch(() => undefined);
    }
    throw err;
  }
}
