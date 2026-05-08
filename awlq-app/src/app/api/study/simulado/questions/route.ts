import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

  const pool = await prisma.studyQuestion.findMany({
    where: {
      active: true,
      certificationPresetId: profile.certificationPresetId,
      usage: { in: ["SIMULADO", "BOTH"] },
      ...(difficulties.length > 0 ? { difficulty: { in: difficulties } } : {}),
    },
    include: {
      certificationPreset: { select: { code: true } },
      awsService: { select: { code: true, name: true } },
      questionOptions: {
        select: {
          order: true,
          content: true,
          isCorrect: true,
          explanation: true,
        },
        orderBy: { order: "asc" },
      },
      questionAwsServices: {
        select: {
          service: {
            select: {
              code: true,
              name: true,
            },
          },
        },
      },
    },
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

  const questions = pickRandomItems(pool, desiredCount).map(mapDbQuestionToStudyQuestion);

  return NextResponse.json({
    questions,
    certificationCode: profile.certificationPreset.code,
    examMinutes: profile.certificationPreset.examMinutes,
    examGuide: buildExamGuidePreview(profile.certificationPreset.examGuide),
  });
}
