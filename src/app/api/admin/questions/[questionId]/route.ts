import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

type OptionLabel = "A" | "B" | "C" | "D" | "E";

type NormalizedOptionItem = {
  order: number;
  content: string;
  isCorrect: boolean;
  explanation: string | null;
};

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
  options?: Array<{
    label?: string;
    content?: string | null;
    explanation?: string | null;
    isCorrect?: boolean;
  }>;
  serviceCodes?: string[] | null;
};

type CurrentQuestionState = {
  id: string;
  questionType: "single" | "multi";
  statement: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  usage: "KC" | "SIMULADO" | "BOTH";
  active: boolean;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  optionE: string | null;
  correctOption: string;
  correctOptions: unknown;
  explanationA: string | null;
  explanationB: string | null;
  explanationC: string | null;
  explanationD: string | null;
  explanationE: string | null;
  awsService: { code: string } | null;
  questionAwsServices: Array<{ service: { code: string } }>;
  questionOptions: NormalizedOptionItem[];
};

function resolveCurrentFrame(current: CurrentQuestionState): {
  options: Record<OptionLabel, string | null>;
  explanations: Record<OptionLabel, string | null>;
  correctOption: OptionLabel;
  correctOptions: OptionLabel[];
} {
  const orderedNormalized = [...(current.questionOptions ?? [])].sort((a, b) => a.order - b.order).slice(0, 5);
  const labels: OptionLabel[] = ["A", "B", "C", "D", "E"];

  if (orderedNormalized.length >= 2) {
    const options: Record<OptionLabel, string | null> = {
      A: orderedNormalized[0]?.content ?? null,
      B: orderedNormalized[1]?.content ?? null,
      C: orderedNormalized[2]?.content ?? null,
      D: orderedNormalized[3]?.content ?? null,
      E: orderedNormalized[4]?.content ?? null,
    };

    const explanations: Record<OptionLabel, string | null> = {
      A: orderedNormalized[0]?.explanation ?? null,
      B: orderedNormalized[1]?.explanation ?? null,
      C: orderedNormalized[2]?.explanation ?? null,
      D: orderedNormalized[3]?.explanation ?? null,
      E: orderedNormalized[4]?.explanation ?? null,
    };

    const correctOptions = orderedNormalized
      .map((option, index) => ({ option, label: labels[index] }))
      .filter((entry): entry is { option: NormalizedOptionItem; label: OptionLabel } => Boolean(entry.label))
      .filter((entry) => entry.option.isCorrect)
      .map((entry) => entry.label);

    return {
      options,
      explanations,
      correctOption: correctOptions[0] ?? "A",
      correctOptions: correctOptions.length > 0 ? correctOptions : ["A"],
    };
  }

  const correctOptions = (Array.isArray(current.correctOptions) ? current.correctOptions : [current.correctOption])
    .map((value) => cleanText(value).toUpperCase())
    .filter((value): value is OptionLabel => isValidOptionLabel(value));

  const resolvedCorrectOption = cleanText(current.correctOption).toUpperCase();

  return {
    options: {
      A: current.optionA,
      B: current.optionB,
      C: current.optionC,
      D: current.optionD,
      E: current.optionE,
    },
    explanations: {
      A: current.explanationA,
      B: current.explanationB,
      C: current.explanationC,
      D: current.explanationD,
      E: current.explanationE,
    },
    correctOption: isValidOptionLabel(resolvedCorrectOption) ? resolvedCorrectOption : "A",
    correctOptions: correctOptions.length > 0 ? correctOptions : ["A"],
  };
}

function toResponseQuestion(item: {
  id: string;
  externalId: string;
  statement: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  questionType: "single" | "multi";
  usage: "KC" | "SIMULADO" | "BOTH";
  active: boolean;
  correctOption: string;
  correctOptions: unknown;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  optionE: string | null;
  explanationA: string | null;
  explanationB: string | null;
  explanationC: string | null;
  explanationD: string | null;
  explanationE: string | null;
  createdAt: Date;
  certificationPreset: { code: string; name: string } | null;
  awsService: { code: string; name: string } | null;
  questionOptions: NormalizedOptionItem[];
  questionAwsServices: Array<{ service: { code: string; name: string } }>;
}) {
  const orderedNormalized = [...(item.questionOptions ?? [])].sort((a, b) => a.order - b.order).slice(0, 5);
  const labels: OptionLabel[] = ["A", "B", "C", "D", "E"];
  const useNormalized = orderedNormalized.length >= 2;

  const normalizedCorrect = useNormalized
    ? orderedNormalized
        .map((option, index) => ({ option, label: labels[index] }))
        .filter((entry): entry is { option: NormalizedOptionItem; label: OptionLabel } => Boolean(entry.label))
        .filter((entry) => entry.option.isCorrect)
        .map((entry) => entry.label)
    : [];

  const legacyCorrectOptions = Array.isArray(item.correctOptions)
    ? item.correctOptions.filter((value): value is string => typeof value === "string")
    : [];

  const correctOptions =
    normalizedCorrect.length > 0
      ? normalizedCorrect
      : legacyCorrectOptions.length > 0
        ? legacyCorrectOptions
        : [item.correctOption];

  const options = ["A", "B", "C", "D", "E"].map((label) => {
    const content =
      label === "A"
        ? useNormalized
          ? (orderedNormalized[0]?.content ?? item.optionA)
          : item.optionA
        : label === "B"
          ? useNormalized
            ? (orderedNormalized[1]?.content ?? item.optionB)
            : item.optionB
          : label === "C"
            ? useNormalized
              ? (orderedNormalized[2]?.content ?? item.optionC)
              : item.optionC
            : label === "D"
              ? useNormalized
                ? (orderedNormalized[3]?.content ?? item.optionD)
                : item.optionD
              : useNormalized
                ? (orderedNormalized[4]?.content ?? null)
                : item.optionE;

    const explanation =
      label === "A"
        ? useNormalized
          ? (orderedNormalized[0]?.explanation ?? item.explanationA)
          : item.explanationA
        : label === "B"
          ? useNormalized
            ? (orderedNormalized[1]?.explanation ?? item.explanationB)
            : item.explanationB
          : label === "C"
            ? useNormalized
              ? (orderedNormalized[2]?.explanation ?? item.explanationC)
              : item.explanationC
            : label === "D"
              ? useNormalized
                ? (orderedNormalized[3]?.explanation ?? item.explanationD)
                : item.explanationD
              : useNormalized
                ? (orderedNormalized[4]?.explanation ?? item.explanationE)
                : item.explanationE;

    return {
      label,
      content,
      explanation,
      isCorrect: correctOptions.includes(label),
    };
  });

  const normalizedServices = item.questionAwsServices?.map((entry) => entry.service) ?? [];
  const allServices = [...normalizedServices, ...(item.awsService ? [item.awsService] : [])].filter(
    (service, index, array) => array.findIndex((candidate) => candidate.code === service.code) === index,
  );
  const primaryService = allServices[0] ?? null;

  return {
    id: item.id,
    externalId: item.externalId,
    statement: item.statement,
    topic: primaryService?.name ?? item.topic,
    difficulty: item.difficulty,
    questionType: item.questionType,
    usage: item.usage,
    active: item.active,
    correctOption: correctOptions[0] ?? item.correctOption,
    correctOptions,
    optionA: useNormalized ? (orderedNormalized[0]?.content ?? item.optionA) : item.optionA,
    optionB: useNormalized ? (orderedNormalized[1]?.content ?? item.optionB) : item.optionB,
    optionC: useNormalized ? (orderedNormalized[2]?.content ?? item.optionC) : item.optionC,
    optionD: useNormalized ? (orderedNormalized[3]?.content ?? item.optionD) : item.optionD,
    optionE: useNormalized ? (orderedNormalized[4]?.content ?? null) : item.optionE,
    explanationA: useNormalized ? (orderedNormalized[0]?.explanation ?? item.explanationA) : item.explanationA,
    explanationB: useNormalized ? (orderedNormalized[1]?.explanation ?? item.explanationB) : item.explanationB,
    explanationC: useNormalized ? (orderedNormalized[2]?.explanation ?? item.explanationC) : item.explanationC,
    explanationD: useNormalized ? (orderedNormalized[3]?.explanation ?? item.explanationD) : item.explanationD,
    explanationE: useNormalized ? (orderedNormalized[4]?.explanation ?? item.explanationE) : item.explanationE,
    options,
    createdAt: item.createdAt,
    certificationPreset: item.certificationPreset,
    awsService: primaryService,
    awsServices: allServices,
  };
}

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
      awsService: {
        select: {
          code: true,
        },
      },
      questionAwsServices: {
        select: {
          service: {
            select: {
              code: true,
            },
          },
        },
      },
      questionOptions: {
        select: {
          order: true,
          content: true,
          isCorrect: true,
          explanation: true,
        },
        orderBy: { order: "asc" },
      },
    },
  });

  if (!current) {
    return NextResponse.json({ error: "Questao nao encontrada." }, { status: 404 });
  }

  const currentServiceCodes = Array.from(
    new Set([
      ...(current.questionAwsServices ?? []).map((entry) => entry.service.code),
      ...(current.awsService?.code ? [current.awsService.code] : []),
    ]),
  );
  const normalizedServiceCodes = Array.from(
    new Set(
      (Array.isArray(body.serviceCodes) ? body.serviceCodes : currentServiceCodes)
        .map((value) => cleanText(value).toUpperCase())
        .filter(Boolean),
    ),
  );

  const servicesToLink =
    normalizedServiceCodes.length > 0
      ? await prisma.awsService.findMany({
          where: {
            code: {
              in: normalizedServiceCodes,
            },
          },
          select: {
            id: true,
            code: true,
          },
        })
      : [];

  if (Array.isArray(body.serviceCodes) && servicesToLink.length !== normalizedServiceCodes.length) {
    const existingCodes = new Set(servicesToLink.map((service) => service.code));
    const missingCodes = normalizedServiceCodes.filter((code) => !existingCodes.has(code));
    return NextResponse.json({ error: `Servicos AWS invalidos: ${missingCodes.join(", ")}.` }, { status: 400 });
  }

  const currentFrame = resolveCurrentFrame(current as CurrentQuestionState);
  const optionLabels: OptionLabel[] = ["A", "B", "C", "D", "E"];
  const payloadOptionMap: Partial<
    Record<OptionLabel, { content: string | null; explanation: string | null; isCorrect: boolean }>
  > = {};

  if (Array.isArray(body.options)) {
    for (let index = 0; index < body.options.length && index < 5; index += 1) {
      const option: NonNullable<PatchBody["options"]>[number] = body.options[index] ?? {};
      const fallbackLabel = optionLabels[index];
      const rawLabel = cleanText(option?.label).toUpperCase();
      const label = isValidOptionLabel(rawLabel) ? rawLabel : fallbackLabel;
      if (!label) {
        continue;
      }

      payloadOptionMap[label] = {
        content: cleanNullableText(option?.content ?? null),
        explanation: cleanNullableText(option?.explanation ?? null),
        isCorrect: Boolean(option?.isCorrect),
      };
    }
  }

  const questionType = body.questionType ?? current.questionType;
  const statement = cleanText(body.statement ?? current.statement);
  const topic = cleanText(body.topic ?? current.topic);
  const optionA = cleanText(payloadOptionMap.A?.content ?? body.optionA ?? currentFrame.options.A ?? "");
  const optionB = cleanText(payloadOptionMap.B?.content ?? body.optionB ?? currentFrame.options.B ?? "");
  const optionC = cleanText(payloadOptionMap.C?.content ?? body.optionC ?? currentFrame.options.C ?? "");
  const optionD = cleanText(payloadOptionMap.D?.content ?? body.optionD ?? currentFrame.options.D ?? "");
  const optionE = cleanNullableText(payloadOptionMap.E?.content ?? body.optionE ?? currentFrame.options.E ?? null);

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

  const payloadCorrectOptions = optionLabels.filter((label) => payloadOptionMap[label]?.isCorrect);
  const nextCorrectOption = cleanText(
    body.correctOption ?? payloadCorrectOptions[0] ?? currentFrame.correctOption,
  ).toUpperCase();
  if (!isValidOptionLabel(nextCorrectOption) || !optionByLabel[nextCorrectOption]) {
    return NextResponse.json({ error: "Gabarito principal invalido para as alternativas atuais." }, { status: 400 });
  }

  const rawCorrectOptions =
    payloadCorrectOptions.length > 0
      ? payloadCorrectOptions
      : Array.isArray(body.correctOptions)
        ? body.correctOptions
        : currentFrame.correctOptions;

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

  const explanationA = cleanNullableText(
    payloadOptionMap.A?.explanation ?? body.explanationA ?? currentFrame.explanations.A,
  );
  const explanationB = cleanNullableText(
    payloadOptionMap.B?.explanation ?? body.explanationB ?? currentFrame.explanations.B,
  );
  const explanationC = cleanNullableText(
    payloadOptionMap.C?.explanation ?? body.explanationC ?? currentFrame.explanations.C,
  );
  const explanationD = cleanNullableText(
    payloadOptionMap.D?.explanation ?? body.explanationD ?? currentFrame.explanations.D,
  );
  const explanationE = cleanNullableText(
    payloadOptionMap.E?.explanation ?? body.explanationE ?? currentFrame.explanations.E,
  );

  const updated = await prisma.$transaction(async (tx) => {
    const updatedQuestion = await tx.studyQuestion.update({
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
        explanationA,
        explanationB,
        explanationC,
        explanationD,
        explanationE,
        awsServiceId: servicesToLink[0]?.id ?? null,
      },
      select: {
        id: true,
      },
    });

    await tx.questionAwsService.deleteMany({
      where: {
        questionId: updatedQuestion.id,
      },
    });

    if (servicesToLink.length > 0) {
      await tx.questionAwsService.createMany({
        data: servicesToLink.map((service) => ({
          questionId: updatedQuestion.id,
          serviceId: service.id,
        })),
      });
    }

    await tx.questionOption.deleteMany({
      where: {
        questionId: updatedQuestion.id,
      },
    });

    const optionEntries: Array<{ label: OptionLabel; content: string | null; explanation: string | null }> = [
      { label: "A", content: optionA, explanation: explanationA },
      { label: "B", content: optionB, explanation: explanationB },
      { label: "C", content: optionC, explanation: explanationC },
      { label: "D", content: optionD, explanation: explanationD },
      { label: "E", content: optionE, explanation: explanationE },
    ];

    const normalizedRows = optionEntries
      .filter((entry, index) => index < 4 || Boolean(entry.content))
      .map((entry, index) => ({
        questionId: updatedQuestion.id,
        content: entry.content ?? "",
        isCorrect: normalizedCorrectOptions.includes(entry.label),
        order: index,
        explanation: entry.explanation,
      }));

    if (normalizedRows.length > 0) {
      await tx.questionOption.createMany({
        data: normalizedRows,
      });
    }

    return tx.studyQuestion.findUnique({
      where: { id: updatedQuestion.id },
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
        questionOptions: {
          select: {
            order: true,
            content: true,
            isCorrect: true,
            explanation: true,
          },
          orderBy: {
            order: "asc",
          },
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
    });
  });

  return NextResponse.json({ question: updated ? toResponseQuestion(updated) : null });
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
