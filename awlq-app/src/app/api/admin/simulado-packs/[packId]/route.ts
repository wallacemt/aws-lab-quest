import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import {
  deleteArtworkFromSupabase,
  isSupabaseArtworkUrl,
  resolveArtworkForStorage,
} from "@/lib/simulado-pack-artwork";

type Params = { params: Promise<{ packId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;

  const { packId } = await params;
  const pack = await prisma.simuladoPack.findUnique({
    where: { id: packId },
    select: {
      id: true,
      name: true,
      active: true,
      questionCount: true,
      difficultyScore: true,
      artworkUrl: true,
      journeyNarrative: true,
      createdAt: true,
      certificationPreset: { select: { id: true, code: true, name: true } },
      questions: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          position: true,
          question: {
            select: {
              id: true,
              statement: true,
              topic: true,
              difficulty: true,
              questionType: true,
            },
          },
        },
      },
    },
  });

  if (!pack) return NextResponse.json({ error: "Pack nao encontrado" }, { status: 404 });

  return NextResponse.json({
    id: pack.id,
    name: pack.name,
    active: pack.active,
    questionCount: pack.questionCount,
    difficultyScore: pack.difficultyScore,
    artworkUrl: pack.artworkUrl ?? null,
    journeyNarrative: pack.journeyNarrative ?? null,
    createdAt: pack.createdAt,
    certificationPreset: pack.certificationPreset,
    questions: pack.questions.map((pq) => ({
      packQuestionId: pq.id,
      position: pq.position,
      ...pq.question,
    })),
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;

  const { packId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    active?: boolean;
    name?: string;
    artworkUrl?: string | null;
    difficultyScore?: number;
    addQuestionIds?: string[];
    removeQuestionIds?: string[];
    journeyNarrative?: { stageName: string; storyText: string; awsContext: string } | null;
  };

  const pack = await prisma.simuladoPack.findUnique({
    where: { id: packId },
    select: { id: true, questionCount: true, artworkUrl: true },
  });
  if (!pack) return NextResponse.json({ error: "Pack nao encontrado" }, { status: 404 });

  const updateData: {
    active?: boolean;
    name?: string;
    artworkUrl?: string | null;
    questionCount?: number;
    difficultyScore?: number;
    journeyNarrative?: { stageName: string; storyText: string; awsContext: string } | null;
  } = {};
  if (body.active !== undefined) updateData.active = body.active;
  if (body.name !== undefined) updateData.name = body.name.trim();
  if (body.difficultyScore !== undefined) updateData.difficultyScore = Math.min(10, Math.max(1, body.difficultyScore));
  if ("journeyNarrative" in body) updateData.journeyNarrative = body.journeyNarrative ?? null;

  let uploadedArtworkForCleanup: string | null = null;
  if ("artworkUrl" in body) {
    try {
      const resolved = await resolveArtworkForStorage(body.artworkUrl ?? null, packId);
      if (resolved && resolved !== body.artworkUrl) {
        uploadedArtworkForCleanup = resolved;
      }
      updateData.artworkUrl = resolved;
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Falha ao processar arte do pack" },
        { status: 502 },
      );
    }
  }

  let newCount = pack.questionCount;

  if (body.removeQuestionIds?.length) {
    await prisma.simuladoPackQuestion.deleteMany({
      where: { packId, questionId: { in: body.removeQuestionIds } },
    });
    newCount -= body.removeQuestionIds.length;
  }

  if (body.addQuestionIds?.length) {
    const existingPositions = await prisma.simuladoPackQuestion.findMany({
      where: { packId },
      select: { position: true },
      orderBy: { position: "desc" },
      take: 1,
    });
    let nextPosition = (existingPositions[0]?.position ?? 0) + 1;

    const alreadyInPack = await prisma.simuladoPackQuestion.findMany({
      where: { packId, questionId: { in: body.addQuestionIds } },
      select: { questionId: true },
    });
    const existingIds = new Set(alreadyInPack.map((r) => r.questionId));
    const toAdd = body.addQuestionIds.filter((id) => !existingIds.has(id));

    if (toAdd.length > 0) {
      await prisma.simuladoPackQuestion.createMany({
        data: toAdd.map((questionId) => ({ packId, questionId, position: nextPosition++ })),
      });
      newCount += toAdd.length;
    }
  }

  updateData.questionCount = Math.max(0, newCount);

  let updated;
  try {
    updated = await prisma.simuladoPack.update({
      where: { id: packId },
      data: updateData,
      select: { id: true, name: true, active: true, questionCount: true },
    });
  } catch (err) {
    if (uploadedArtworkForCleanup) {
      await deleteArtworkFromSupabase(uploadedArtworkForCleanup).catch(() => undefined);
    }
    throw err;
  }

  if ("artworkUrl" in body && pack.artworkUrl && pack.artworkUrl !== updateData.artworkUrl && isSupabaseArtworkUrl(pack.artworkUrl)) {
    await deleteArtworkFromSupabase(pack.artworkUrl).catch(() => undefined);
  }

  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;

  const { packId } = await params;
  const pack = await prisma.simuladoPack.findUnique({
    where: { id: packId },
    select: { id: true, artworkUrl: true, _count: { select: { sessions: true } } },
  });
  if (!pack) return NextResponse.json({ error: "Pack nao encontrado" }, { status: 404 });

  if (pack._count.sessions > 0) {
    await prisma.simuladoPack.update({ where: { id: packId }, data: { active: false } });
    return NextResponse.json({ deleted: false, deactivated: true });
  }

  await prisma.simuladoPack.delete({ where: { id: packId } });

  if (pack.artworkUrl && isSupabaseArtworkUrl(pack.artworkUrl)) {
    await deleteArtworkFromSupabase(pack.artworkUrl).catch(() => undefined);
  }

  return NextResponse.json({ deleted: true });
}
