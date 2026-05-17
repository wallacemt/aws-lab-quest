import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { getPackNameByIndex } from "@/lib/simulado-pack-names";

const PACK_SIZE = 65;
const DIFFICULTY_RATIOS = { easy: 0.3, medium: 0.5, hard: 0.2 };

type GenerateBody = {
  certificationCode: string;
};

function pickByDifficulty(
  questions: { id: string; difficulty: string }[],
  total: number,
): string[] {
  const easy = questions.filter((q) => q.difficulty === "easy");
  const medium = questions.filter((q) => q.difficulty === "medium");
  const hard = questions.filter((q) => q.difficulty === "hard");

  const targets = {
    easy: Math.round(total * DIFFICULTY_RATIOS.easy),
    medium: Math.round(total * DIFFICULTY_RATIOS.medium),
    hard: total - Math.round(total * DIFFICULTY_RATIOS.easy) - Math.round(total * DIFFICULTY_RATIOS.medium),
  };

  function pick(pool: typeof questions, count: number): string[] {
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count).map((q) => q.id);
  }

  const picked: string[] = [
    ...pick(easy, Math.min(targets.easy, easy.length)),
    ...pick(medium, Math.min(targets.medium, medium.length)),
    ...pick(hard, Math.min(targets.hard, hard.length)),
  ];

  if (picked.length < total) {
    const remaining = questions
      .filter((q) => !picked.includes(q.id))
      .sort(() => Math.random() - 0.5)
      .slice(0, total - picked.length)
      .map((q) => q.id);
    picked.push(...remaining);
  }

  return picked.sort(() => Math.random() - 0.5);
}

export async function POST(request: NextRequest) {
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;
  const adminSession = adminResult;

  const body = (await request.json().catch(() => ({}))) as Partial<GenerateBody>;
  const certificationCode = body.certificationCode?.trim();
  if (!certificationCode) {
    return NextResponse.json({ error: "certificationCode obrigatorio" }, { status: 400 });
  }

  const certPreset = await prisma.certificationPreset.findUnique({
    where: { code: certificationCode },
    select: { id: true, code: true, name: true },
  });
  if (!certPreset) {
    return NextResponse.json({ error: "Certificacao nao encontrada" }, { status: 404 });
  }

  const alreadyInPack = await prisma.simuladoPackQuestion.findMany({
    where: { pack: { certificationPresetId: certPreset.id, active: true } },
    select: { questionId: true },
  });
  const usedIds = new Set(alreadyInPack.map((r) => r.questionId));

  const availableQuestions = await prisma.studyQuestion.findMany({
    where: {
      certificationPresetId: certPreset.id,
      active: true,
      usage: { in: ["SIMULADO", "BOTH"] },
      id: { notIn: Array.from(usedIds) },
    },
    select: { id: true, difficulty: true },
  });

  if (availableQuestions.length < PACK_SIZE) {
    return NextResponse.json(
      {
        error: `Questoes insuficientes. Disponivel: ${availableQuestions.length}, necessario: ${PACK_SIZE}`,
        available: availableQuestions.length,
        required: PACK_SIZE,
      },
      { status: 422 },
    );
  }

  const existingPackCount = await prisma.simuladoPack.count({
    where: { certificationPresetId: certPreset.id },
  });

  const packsToCreate = Math.floor(availableQuestions.length / PACK_SIZE);
  const remaining = [...availableQuestions];
  const createdPacks: { id: string; name: string }[] = [];

  for (let i = 0; i < packsToCreate; i++) {
    const packName = getPackNameByIndex(existingPackCount + i);
    const selectedIds = pickByDifficulty(remaining, PACK_SIZE);
    const selectedSet = new Set(selectedIds);

    for (let j = remaining.length - 1; j >= 0; j--) {
      if (selectedSet.has(remaining[j]!.id)) {
        remaining.splice(j, 1);
      }
    }

    const pack = await prisma.simuladoPack.create({
      data: {
        name: packName,
        certificationPresetId: certPreset.id,
        createdByUserId: adminSession.userId,
        questionCount: PACK_SIZE,
        active: true,
        questions: {
          create: selectedIds.map((questionId, position) => ({
            questionId,
            position,
          })),
        },
      },
      select: { id: true, name: true },
    });

    createdPacks.push(pack);
  }

  return NextResponse.json({
    created: createdPacks.length,
    packs: createdPacks,
    certification: certPreset.code,
  });
}

export async function GET(request: NextRequest) {
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;

  const { searchParams } = new URL(request.url);
  const certificationCode = searchParams.get("certificationCode") ?? "";
  if (!certificationCode) {
    return NextResponse.json({ error: "certificationCode obrigatorio" }, { status: 400 });
  }

  const certPreset = await prisma.certificationPreset.findUnique({
    where: { code: certificationCode },
    select: { id: true },
  });
  if (!certPreset) {
    return NextResponse.json({ available: 0, packsPossible: 0 });
  }

  const alreadyInPack = await prisma.simuladoPackQuestion.findMany({
    where: { pack: { certificationPresetId: certPreset.id, active: true } },
    select: { questionId: true },
  });
  const usedIds = new Set(alreadyInPack.map((r) => r.questionId));

  const available = await prisma.studyQuestion.count({
    where: {
      certificationPresetId: certPreset.id,
      active: true,
      usage: { in: ["SIMULADO", "BOTH"] },
      id: { notIn: Array.from(usedIds) },
    },
  });

  return NextResponse.json({
    available,
    packsPossible: Math.floor(available / PACK_SIZE),
    packSize: PACK_SIZE,
  });
}
