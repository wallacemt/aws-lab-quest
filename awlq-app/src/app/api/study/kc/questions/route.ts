import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { mapDbQuestionToStudyQuestion, pickRandomItems } from "@/lib/study-questions";
import { fetchGapServiceCodes, buildDifficultyAwareWhere } from "../_kc-helpers";

type Body = {
  topics?: string[];
  count?: number;
};

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as Body;
  const topics = (body.topics ?? []).map((topic) => topic.trim()).filter(Boolean);
  const count = Math.max(5, Math.min(30, Number(body.count ?? 10)));
  const maxTopics = Math.max(1, Math.floor(count / 5));

  if (topics.length > maxTopics) {
    return NextResponse.json(
      { error: `Com ${count} questoes, selecione no maximo ${maxTopics} servicos.` },
      { status: 400 },
    );
  }

  const profile = await prisma.userProfile.findUnique({
    where: { userId: session.user.id },
    select: {
      certificationPresetId: true,
      certificationPreset: { select: { id: true, code: true, name: true } },
    },
  });

  if (!profile?.certificationPresetId || !profile.certificationPreset?.code) {
    return NextResponse.json(
      { error: "Defina sua certificacao alvo no perfil antes de iniciar um KC." },
      { status: 400 },
    );
  }

  // Identify gap services to scale difficulty (Issue #17).
  const gapCodes = await fetchGapServiceCodes(profile.certificationPresetId);

  const baseWhere: Prisma.StudyQuestionWhereInput = {
    active: true,
    certificationPresetId: profile.certificationPresetId,
    usage: { in: ["KC", "BOTH"] as Array<"KC" | "BOTH"> },
  };

  const difficultyAwareWhere = buildDifficultyAwareWhere(topics, gapCodes, baseWhere);

  const questionInclude = {
    certificationPreset: { select: { code: true } },
    awsService: { select: { code: true, name: true } },
    questionOptions: {
      select: { order: true, content: true, isCorrect: true, explanation: true },
      orderBy: { order: "asc" },
    },
    questionAwsServices: {
      select: { service: { select: { code: true, name: true } } },
    },
  } satisfies Prisma.StudyQuestionInclude;

  const questions = await prisma.studyQuestion.findMany({
    where: difficultyAwareWhere,
    include: questionInclude,
    take: 200,
  });

  const questionPool = questions;
  let generationRequestId: string | null = null;

  const gap = count - questionPool.length;

  // Fallback difficulty for generated questions: match the gap-aware selection above.
  const hasGapTopic = topics.some((t) => gapCodes.has(t.toUpperCase()));
  const fallbackDifficulty = hasGapTopic ? "hard" : "medium";

  if (gap > 0) {
    // All shortfalls — regardless of size — go through enqueue+poll (DEF-005).
    // Worker adds to kcGenerationQueue with priority 1 — user-facing, runs ahead of
    // scheduled background jobs (ADR-KC-02). Client polls generate-status to backfill.
    generationRequestId = randomBytes(16).toString("hex");

    // One trigger per topic so every selected service gets backfilled (DEF-002).
    // For no-topic requests, a single "AWS General" trigger covers the gap.
    const enqueueTargets =
      topics.length > 0
        ? topics.map((code) => ({ serviceCode: code, topic: null as string | null }))
        : [{ serviceCode: null as string | null, topic: "AWS General" }];
    const countPerTarget = Math.ceil(gap / enqueueTargets.length);

    for (const { serviceCode, topic } of enqueueTargets) {
      await prisma.workerTrigger.create({
        data: {
          action: "generate-kc",
          source: "kc_gap_fill",
          payload: {
            requestId: generationRequestId,
            userId: session.user.id,
            serviceCode,
            topic,
            difficulty: fallbackDifficulty,
            count: countPerTarget,
          },
        },
      });
    }
  }

  if (questionPool.length === 0) {
    // Pool is empty but background generation was enqueued.
    // Return 200 so the client enters the loading/polling flow (DEF-003).
    if (generationRequestId) {
      return NextResponse.json({ questions: [], insufficient: true, generationRequestId });
    }
    return NextResponse.json(
      { error: "Nenhuma questao encontrada para os criterios selecionados." },
      { status: 404 },
    );
  }

  const selected = pickRandomItems(questionPool, Math.min(count, questionPool.length)).map(mapDbQuestionToStudyQuestion);
  return NextResponse.json({
    questions: selected,
    generationRequestId, // non-null when background generation was enqueued
    insufficient: generationRequestId !== null, // pool had fewer questions than requested
  });
}
