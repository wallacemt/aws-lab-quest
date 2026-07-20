import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { mapDbQuestionToStudyQuestion } from "@/lib/study-questions";

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

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const packId = searchParams.get("packId");
  if (!packId) return NextResponse.json({ error: "packId obrigatorio" }, { status: 400 });

  const pack = await prisma.simuladoPack.findUnique({
    where: { id: packId, active: true },
    select: {
      id: true,
      name: true,
      questionCount: true,
      certificationPreset: { select: { code: true, examMinutes: true, examGuide: true } },
      questions: {
        orderBy: { position: "asc" },
        select: { questionId: true },
      },
    },
  });

  if (!pack) return NextResponse.json({ error: "Pack nao encontrado ou inativo" }, { status: 404 });

  const examGuide = pack.certificationPreset?.examGuide ?? "";
  if (examGuide.trim().length < 120) {
    return NextResponse.json(
      {
        error:
          "Guia oficial da certificacao nao encontrado. O admin precisa enviar o Exam Guide antes de liberar simulados.",
      },
      { status: 400 },
    );
  }

  const questionIds = pack.questions.map((pq) => pq.questionId);

  const dbQuestions = await prisma.studyQuestion.findMany({
    where: { id: { in: questionIds }, active: true },
    include: questionInclude,
  });

  const questionById = new Map(dbQuestions.map((q) => [q.id, q]));
  const orderedQuestions = questionIds
    .map((id) => questionById.get(id))
    .filter((q): q is NonNullable<typeof q> => q !== null)
    .map(mapDbQuestionToStudyQuestion);

  return NextResponse.json({
    packId: pack.id,
    packName: pack.name,
    questions: orderedQuestions,
    certificationCode: pack.certificationPreset?.code ?? "AWS",
    examMinutes: pack.certificationPreset?.examMinutes ?? 90,
    examGuide: { markdown: examGuide, preview: examGuide.slice(0, 2400), highlights: [], totalChars: examGuide.length },
  });
}
