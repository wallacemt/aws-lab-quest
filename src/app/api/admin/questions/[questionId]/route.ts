import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    questionId: string;
  }>;
};

type PatchBody = {
  statement?: string;
  topic?: string;
  difficulty?: "easy" | "medium" | "hard";
  questionType?: "single" | "multi";
  usage?: "KC" | "SIMULADO" | "BOTH";
  active?: boolean;
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  optionE?: string | null;
  correctOption?: string;
  correctOptions?: string[] | null;
  explanationA?: string | null;
  explanationB?: string | null;
  explanationC?: string | null;
  explanationD?: string | null;
  explanationE?: string | null;
};

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function cleanNullableText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function isValidOptionLabel(value: string): value is "A" | "B" | "C" | "D" | "E" {
  return value === "A" || value === "B" || value === "C" || value === "D" || value === "E";
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  const { questionId } = await context.params;

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Payload invalido." }, { status: 400 });
  }

  const current = await prisma.studyQuestion.findUnique({
    where: { id: questionId },
    select: {
      id: true,
      questionType: true,
      statement: true,
      topic: true,
      difficulty: true,
      usage: true,
      active: true,
      optionA: true,
      optionB: true,
      optionC: true,
      optionD: true,
      optionE: true,
      correctOption: true,
      correctOptions: true,
      explanationA: true,
      explanationB: true,
      explanationC: true,
      explanationD: true,
      explanationE: true,
    },
  });

  if (!current) {
    return NextResponse.json({ error: "Questao nao encontrada." }, { status: 404 });
  }

  const questionType = body.questionType ?? current.questionType;
  const statement = cleanText(body.statement ?? current.statement);
  const topic = cleanText(body.topic ?? current.topic);
  const optionA = cleanText(body.optionA ?? current.optionA);
  const optionB = cleanText(body.optionB ?? current.optionB);
  const optionC = cleanText(body.optionC ?? current.optionC);
  const optionD = cleanText(body.optionD ?? current.optionD);
  const optionE = cleanNullableText(body.optionE ?? current.optionE);

  if (!statement || statement.length < 20) {
    return NextResponse.json({ error: "Enunciado muito curto." }, { status: 400 });
  }

  if (!topic) {
    return NextResponse.json({ error: "Topico obrigatorio." }, { status: 400 });
  }

  if (!optionA || !optionB || !optionC || !optionD) {
    return NextResponse.json({ error: "Alternativas A ate D sao obrigatorias." }, { status: 400 });
  }

  const optionByLabel: Record<"A" | "B" | "C" | "D" | "E", string | null> = {
    A: optionA,
    B: optionB,
    C: optionC,
    D: optionD,
    E: optionE,
  };

  const nextCorrectOption = cleanText(body.correctOption ?? current.correctOption).toUpperCase();
  if (!isValidOptionLabel(nextCorrectOption) || !optionByLabel[nextCorrectOption]) {
    return NextResponse.json({ error: "Gabarito principal invalido para as alternativas atuais." }, { status: 400 });
  }

  const rawCorrectOptions = Array.isArray(body.correctOptions)
    ? body.correctOptions
    : Array.isArray(current.correctOptions)
      ? (current.correctOptions as string[])
      : [nextCorrectOption];

  const normalizedCorrectOptions = Array.from(
    new Set(
      rawCorrectOptions
        .map((value) => cleanText(value).toUpperCase())
        .filter((value): value is "A" | "B" | "C" | "D" | "E" => isValidOptionLabel(value))
        .filter((value) => Boolean(optionByLabel[value])),
    ),
  );

  if (questionType === "multi" && normalizedCorrectOptions.length === 0) {
    return NextResponse.json(
      { error: "Questao multipla precisa de pelo menos uma resposta correta." },
      { status: 400 },
    );
  }

  if (questionType === "single") {
    normalizedCorrectOptions.splice(0, normalizedCorrectOptions.length, nextCorrectOption);
  }

  const updated = await prisma.studyQuestion.update({
    where: { id: questionId },
    data: {
      statement,
      topic,
      difficulty: body.difficulty ?? current.difficulty,
      questionType,
      usage: body.usage ?? current.usage,
      active: typeof body.active === "boolean" ? body.active : current.active,
      optionA,
      optionB,
      optionC,
      optionD,
      optionE,
      correctOption: nextCorrectOption,
      correctOptions: normalizedCorrectOptions,
      explanationA: cleanNullableText(body.explanationA ?? current.explanationA),
      explanationB: cleanNullableText(body.explanationB ?? current.explanationB),
      explanationC: cleanNullableText(body.explanationC ?? current.explanationC),
      explanationD: cleanNullableText(body.explanationD ?? current.explanationD),
      explanationE: cleanNullableText(body.explanationE ?? current.explanationE),
    },
    select: {
      id: true,
      externalId: true,
      statement: true,
      topic: true,
      difficulty: true,
      questionType: true,
      usage: true,
      active: true,
      correctOption: true,
      correctOptions: true,
      optionA: true,
      optionB: true,
      optionC: true,
      optionD: true,
      optionE: true,
      explanationA: true,
      explanationB: true,
      explanationC: true,
      explanationD: true,
      explanationE: true,
      createdAt: true,
      certificationPreset: {
        select: {
          code: true,
          name: true,
        },
      },
      awsService: {
        select: {
          code: true,
          name: true,
        },
      },
    },
  });

  return NextResponse.json({ question: updated });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  const { questionId } = await context.params;

  const existing = await prisma.studyQuestion.findUnique({
    where: { id: questionId },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Questao nao encontrada." }, { status: 404 });
  }

  await prisma.studyQuestion.delete({ where: { id: questionId } });
  return NextResponse.json({ deleted: true, id: questionId });
}
