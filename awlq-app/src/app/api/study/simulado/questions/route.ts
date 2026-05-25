import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateAndSaveVariant } from "@/lib/question-variant";
import { mapDbQuestionToStudyQuestion, pickRandomItems } from "@/lib/study-questions";

const VALID_DIFFICULTIES = new Set(["easy", "medium", "hard"]);

type Body = {
  count?: number;
  difficulties?: string[];
};

function buildExamGuidePreview(guide: string): {
  markdown: string;
  preview: string;
  highlights: string[];
  totalChars: number;
} {
  const normalized = guide.replace(/\r\n/g, "\n").trim();
  const plainText = normalized
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1");

  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length >= 8)
    .slice(0, 30);

  const highlights = lines
    .filter((line) => /\d+\s*%|domain|dominio|area|objetivo|task statement|\b[A-Z]{2,6}-\w+/.test(line))
    .slice(0, 6);

  return {
    markdown: normalized,
    preview: plainText.slice(0, 2400),
    highlights,
    totalChars: normalized.length,
  };
}

async function getUserCertificationContext(userId: string) {
  return prisma.userProfile.findUnique({
    where: { userId },
    select: {
      certificationPresetId: true,
      certificationPreset: { select: { code: true, name: true, examMinutes: true, examGuide: true } },
    },
  });
}

function buildGuideErrorResponse() {
  return NextResponse.json(
    {
      error:
        "Guia oficial da certificacao nao encontrado. O admin precisa enviar o Exam Guide antes de liberar simulados.",
    },
    { status: 400 },
  );
}

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await getUserCertificationContext(session.user.id);

  if (!profile?.certificationPresetId || !profile.certificationPreset?.code) {
    return NextResponse.json(
      { error: "Defina sua certificacao alvo no perfil antes de iniciar um simulado." },
      { status: 400 },
    );
  }

  if (!profile.certificationPreset.examGuide || profile.certificationPreset.examGuide.trim().length < 120) {
    return buildGuideErrorResponse();
  }

  return NextResponse.json({
    certificationCode: profile.certificationPreset.code,
    examMinutes: profile.certificationPreset.examMinutes,
    examGuide: buildExamGuidePreview(profile.certificationPreset.examGuide),
  });
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as Body;
  const desiredCount = Math.max(10, Math.min(65, Number(body.count ?? 65)));
  const difficulties = (body.difficulties ?? []).filter((value) => VALID_DIFFICULTIES.has(value)) as Array<
    "easy" | "medium" | "hard"
  >;

  const profile = await getUserCertificationContext(session.user.id);

  if (!profile?.certificationPresetId || !profile.certificationPreset?.code) {
    return NextResponse.json(
      { error: "Defina sua certificacao alvo no perfil antes de iniciar um simulado." },
      { status: 400 },
    );
  }

  if (!profile.certificationPreset.examGuide || profile.certificationPreset.examGuide.trim().length < 120) {
    return buildGuideErrorResponse();
  }

  const questionInclude = {
    certificationPreset: { select: { code: true } },
    awsService: { select: { code: true, name: true } },
    questionOptions: {
      select: { order: true, content: true, isCorrect: true, explanation: true },
      orderBy: { order: "asc" as const },
    },
    questionAwsServices: {
      select: { service: { select: { code: true, name: true } } },
    },
  };

  const pool = await prisma.studyQuestion.findMany({
    where: {
      active: true,
      certificationPresetId: profile.certificationPresetId,
      usage: { in: ["SIMULADO", "BOTH"] },
      ...(difficulties.length > 0 ? { difficulty: { in: difficulties } } : {}),
    },
    include: questionInclude,
    take: 400,
  });

  if (pool.length < desiredCount) {
    return NextResponse.json(
      {
        error: `Banco de questoes insuficiente para ${profile.certificationPreset.code}. Disponivel: ${pool.length}, necessario: ${desiredCount}.`,
      },
      { status: 400 },
    );
  }

  // Buscar IDs de questões já respondidas nos últimos 5 simulados
  const recentHistory = await prisma.studySessionHistory.findMany({
    where: { userId: session.user.id, sessionType: "SIMULADO" },
    select: { answersSnapshot: true },
    orderBy: { completedAt: "desc" },
    take: 5,
  });

  const answeredIds = new Set<string>(
    recentHistory.flatMap((h) => {
      const snapshot = h.answersSnapshot;
      if (!Array.isArray(snapshot)) return [];
      return (snapshot as Array<{ questionId?: unknown }>)
        .map((item) => (typeof item.questionId === "string" ? item.questionId : null))
        .filter((id): id is string => id !== null);
    }),
  );

  const freshPool = answeredIds.size > 0 ? pool.filter((q) => !answeredIds.has(q.id)) : pool;

  let selectedPool = freshPool;

  if (freshPool.length < desiredCount) {
    const needed = desiredCount - freshPool.length;
    const MAX_VARIANTS = 10;
    const toGenerate = Math.min(needed, MAX_VARIANTS);

    // Seleciona questões já respondidas para gerar variantes mais difíceis
    const alreadyAnswered = pool.filter((q) => answeredIds.has(q.id));
    const sourcesForVariants = pickRandomItems(alreadyAnswered, toGenerate);

    const variantIds = (
      await Promise.all(
        sourcesForVariants.map((source) =>
          generateAndSaveVariant({
            id: source.id,
            statement: source.statement,
            topic: source.topic,
            difficulty: source.difficulty,
            optionA: source.optionA,
            optionB: source.optionB,
            optionC: source.optionC,
            optionD: source.optionD,
            optionE: source.optionE ?? null,
            correctOption: source.correctOption,
            certificationPresetId: source.certificationPresetId ?? null,
            certificationPreset: source.certificationPreset
              ? { code: source.certificationPreset.code, name: source.certificationPreset.code }
              : null,
          }),
        ),
      )
    ).filter((id): id is string => id !== null);

    if (variantIds.length > 0) {
      const newVariants = await prisma.studyQuestion.findMany({
        where: { id: { in: variantIds } },
        include: questionInclude,
      });
      selectedPool = [...freshPool, ...newVariants];
    }

    // Fallback: se ainda não tiver suficiente, usa questões já respondidas para completar
    if (selectedPool.length < desiredCount) {
      const remaining = desiredCount - selectedPool.length;
      const usedIds = new Set(selectedPool.map((q) => q.id));
      const fallback = pool.filter((q) => !usedIds.has(q.id)).slice(0, remaining);
      selectedPool = [...selectedPool, ...fallback];
    }
  }

  const questions = pickRandomItems(selectedPool, desiredCount).map(mapDbQuestionToStudyQuestion);

  return NextResponse.json({
    questions,
    certificationCode: profile.certificationPreset.code,
    examMinutes: profile.certificationPreset.examMinutes,
    examGuide: buildExamGuidePreview(profile.certificationPreset.examGuide),
  });
}
