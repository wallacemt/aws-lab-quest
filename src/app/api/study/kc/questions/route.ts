import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureQuestionPool } from "@/lib/study-question-generation";
import { mapDbQuestionToStudyQuestion, pickRandomItems } from "@/lib/study-questions";

const VALID_DIFFICULTIES = new Set(["easy", "medium", "hard"]);

type Body = {
  topics?: string[];
  difficulty?: string;
  count?: number;
};

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as Body;
  const topics = (body.topics ?? []).map((topic) => topic.trim()).filter(Boolean);
  const difficulty = VALID_DIFFICULTIES.has(String(body.difficulty ?? "easy"))
    ? (body.difficulty as "easy" | "medium" | "hard")
    : "easy";
  const count = Math.max(1, Math.min(20, Number(body.count ?? 10)));

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

  await ensureQuestionPool({
    certification: {
      id: profile.certificationPreset.id,
      code: profile.certificationPreset.code,
      name: profile.certificationPreset.name,
    },
    usage: "KC",
    difficulty,
    desiredCount: count,
    selectedServiceCodes: topics,
  });

  const questions = await prisma.studyQuestion.findMany({
    where: {
      active: true,
      certificationPresetId: profile.certificationPresetId,
      usage: { in: ["KC", "BOTH"] },
      ...(topics.length > 0 ? { awsService: { code: { in: topics } } } : {}),
      difficulty,
    },
    include: {
      certificationPreset: { select: { code: true } },
      awsService: { select: { code: true, name: true } },
    },
    take: 200,
  });

  if (questions.length === 0) {
    return NextResponse.json({ error: "Nenhuma questao encontrada para os filtros selecionados." }, { status: 404 });
  }

  const selected = pickRandomItems(questions, count).map(mapDbQuestionToStudyQuestion);
  return NextResponse.json({ questions: selected });
}
