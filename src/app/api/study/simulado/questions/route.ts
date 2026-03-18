import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureQuestionPool } from "@/lib/study-question-generation";
import { mapDbQuestionToStudyQuestion, pickRandomItems } from "@/lib/study-questions";

const VALID_DIFFICULTIES = new Set(["easy", "medium", "hard"]);

type Body = {
  count?: number;
  difficulties?: string[];
};

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

  const profile = await prisma.userProfile.findUnique({
    where: { userId: session.user.id },
    select: {
      certificationPresetId: true,
      certificationPreset: { select: { code: true, name: true, examMinutes: true, examGuide: true } },
    },
  });

  if (!profile?.certificationPresetId || !profile.certificationPreset?.code) {
    return NextResponse.json(
      { error: "Defina sua certificacao alvo no perfil antes de iniciar um simulado." },
      { status: 400 },
    );
  }

  if (!profile.certificationPreset.examGuide || profile.certificationPreset.examGuide.trim().length < 120) {
    return NextResponse.json(
      {
        error:
          "Guia oficial da certificacao nao encontrado. O admin precisa enviar o Exam Guide antes de liberar simulados.",
      },
      { status: 400 },
    );
  }

  const selectedDifficulties = difficulties.length > 0 ? difficulties : (["easy", "medium", "hard"] as const);

  for (const difficulty of selectedDifficulties) {
    await ensureQuestionPool({
      certification: {
        id: profile.certificationPresetId,
        code: profile.certificationPreset.code,
        name: profile.certificationPreset.name,
      },
      usage: "SIMULADO",
      difficulty,
      desiredCount: Math.ceil(desiredCount / selectedDifficulties.length) + 8,
    });
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
  });
}
