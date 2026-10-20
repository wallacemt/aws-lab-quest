import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import {
  pickByDifficulty,
  computeDifficultyScore,
  resolveUniquePackIdentity,
  type PriorStage,
} from "@/lib/simulado-pack-generation";

const PACK_SIZE = 65;

type GenerateBody = {
  certificationCode: string;
};

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

  const priorStages: PriorStage[] = (
    await prisma.simuladoPack.findMany({
      where: { certificationPresetId: certPreset.id },
      select: { journeyNarrative: true },
      orderBy: { createdAt: "asc" },
    })
  )
    .map((p) => p.journeyNarrative as PriorStage | null)
    .filter((n): n is PriorStage => !!n?.stageName);

  const stageTotal = existingPackCount + packsToCreate;

  for (let i = 0; i < packsToCreate; i++) {
    const stageIndex = existingPackCount + i + 1;
    const selectedIds = pickByDifficulty(remaining, PACK_SIZE);
    const selectedSet = new Set(selectedIds);
    const selectedQuestions = remaining.filter((q) => selectedSet.has(q.id));

    for (let j = remaining.length - 1; j >= 0; j--) {
      if (selectedSet.has(remaining[j]!.id)) {
        remaining.splice(j, 1);
      }
    }

    const identity = await resolveUniquePackIdentity({
      certCode: certPreset.code,
      certName: certPreset.name,
      stageIndex,
      stageTotal,
      priorStages,
      fallbackIndex: existingPackCount + i,
    });
    if (identity.stageName) priorStages.push({ stageName: identity.stageName, awsContext: identity.awsContext });

    const pack = await prisma.simuladoPack.create({
      data: {
        name: identity.packName,
        certificationPresetId: certPreset.id,
        createdByUserId: adminSession.userId,
        questionCount: PACK_SIZE,
        difficultyScore: computeDifficultyScore(selectedQuestions),
        active: true,
        journeyNarrative: identity.stageName
          ? { stageName: identity.stageName, storyText: identity.storyText, awsContext: identity.awsContext }
          : undefined,
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
