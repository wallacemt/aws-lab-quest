import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;

  const { searchParams } = new URL(request.url);
  const certificationCode = searchParams.get("certificationCode") ?? undefined;
  const activeParam = searchParams.get("active");
  const active = activeParam === "true" ? true : activeParam === "false" ? false : undefined;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10)));

  const where = {
    ...(certificationCode
      ? { certificationPreset: { code: certificationCode } }
      : {}),
    ...(active !== undefined ? { active } : {}),
  };

  const [total, packs] = await Promise.all([
    prisma.simuladoPack.count({ where }),
    prisma.simuladoPack.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        certificationPreset: { select: { code: true, name: true } },
        createdBy: { select: { name: true, email: true } },
        _count: { select: { sessions: true } },
      },
    }),
  ]);

  const items = packs.map((p) => ({
    id: p.id,
    name: p.name,
    certificationCode: p.certificationPreset?.code ?? null,
    certificationName: p.certificationPreset?.name ?? null,
    questionCount: p.questionCount,
    difficultyScore: p.difficultyScore,
    active: p.active,
    artworkUrl: p.artworkUrl ?? null,
    createdAt: p.createdAt.toISOString(),
    createdByName: p.createdBy?.name ?? null,
    sessionCount: p._count.sessions,
  }));

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

  const pack = await prisma.simuladoPack.create({
    data: {
      name,
      certificationPresetId: certPreset.id,
      createdByUserId: adminResult.userId,
      questionCount: questionIds.length,
      difficultyScore,
      active: true,
      artworkUrl: body.artworkUrl ?? "https://djitwkagdqgbhanenonk.supabase.co/storage/v1/object/public/aws-lab-quest/cert-badges/527007c2-c79f-4240-8a20-4b502c2f5b04.png",
      questions: {
        create: questionIds.map((questionId, position) => ({ questionId, position })),
      },
    },
    select: { id: true, name: true, questionCount: true, difficultyScore: true, artworkUrl: true },
  });

  return NextResponse.json(pack, { status: 201 });
}
