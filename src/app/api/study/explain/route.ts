import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAiModel, extractJsonObject } from "@/lib/ai";
import { prisma } from "@/lib/prisma";
import { normalizeOptionArray, normalizeQuestionType } from "@/lib/study-answer-utils";
import { QuestionOption, QuestionOptionMapping } from "@/lib/types";

type Body = {
  questionId?: string;
  selectedOption?: QuestionOption;
  selectedOptions?: QuestionOption[];
  optionMapping?: QuestionOptionMapping;
};

type ExplainOptions = Record<QuestionOption, string>;

type ResolvedQuestionFrame = {
  options: Record<QuestionOption, string>;
  explanations: ExplainOptions;
  correctOption: QuestionOption;
  correctOptions: QuestionOption[];
};

const EXPLAIN_CACHE_VERSION = 1;
const EXPLAIN_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function isOptionKey(value: string): value is QuestionOption {
  return value === "A" || value === "B" || value === "C" || value === "D" || value === "E";
}

function normalizeExplainOptions(
  options: Partial<Record<QuestionOption, string>> | undefined,
  fallback: ExplainOptions,
) {
  return {
    A: options?.A ?? fallback.A,
    B: options?.B ?? fallback.B,
    C: options?.C ?? fallback.C,
    D: options?.D ?? fallback.D,
    E: options?.E ?? fallback.E,
  } satisfies ExplainOptions;
}

function toOriginalOptionFrame(selectedOption: QuestionOption, optionMapping?: QuestionOptionMapping): QuestionOption {
  const mapped = optionMapping?.displayToOriginal?.[selectedOption];
  return mapped && isOptionKey(mapped) ? mapped : selectedOption;
}

function toDisplayCorrectOption(
  originalCorrectOption: QuestionOption,
  optionMapping?: QuestionOptionMapping,
): QuestionOption {
  const mapped = optionMapping?.originalToDisplay?.[originalCorrectOption];
  return mapped && isOptionKey(mapped) ? mapped : originalCorrectOption;
}

function toDisplayCorrectOptions(
  originalCorrectOptions: QuestionOption[],
  optionMapping?: QuestionOptionMapping,
): QuestionOption[] {
  const mapped = originalCorrectOptions.map((option) => toDisplayCorrectOption(option, optionMapping));
  return Array.from(new Set(mapped)).sort();
}

function toDisplayFrameOptions(
  optionsInOriginalFrame: ExplainOptions,
  optionMapping?: QuestionOptionMapping,
): ExplainOptions {
  if (!optionMapping) {
    return optionsInOriginalFrame;
  }

  const base: ExplainOptions = {
    ...optionsInOriginalFrame,
  };

  for (const displayOption of ["A", "B", "C", "D", "E"] as const) {
    const originalOption = optionMapping.displayToOriginal?.[displayOption];
    if (originalOption && isOptionKey(originalOption)) {
      base[displayOption] = optionsInOriginalFrame[originalOption] ?? "Sem explicacao.";
    }
  }

  return base;
}

function isCacheValid(cachedAt: Date | null | undefined, cachedVersion: number): boolean {
  if (!cachedAt) {
    return false;
  }
  if (cachedVersion !== EXPLAIN_CACHE_VERSION) {
    return false;
  }

  return Date.now() - cachedAt.getTime() <= EXPLAIN_CACHE_TTL_MS;
}

function resolveQuestionFrame(question: {
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
  correctOption: string;
  correctOptions: unknown;
  questionOptions: Array<{
    order: number;
    content: string;
    isCorrect: boolean;
    explanation: string | null;
  }>;
}): ResolvedQuestionFrame {
  const orderedNormalized = [...(question.questionOptions ?? [])].sort((a, b) => a.order - b.order).slice(0, 5);
  const labels: QuestionOption[] = ["A", "B", "C", "D", "E"];

  if (orderedNormalized.length >= 2) {
    const options: Record<QuestionOption, string> = {
      A: orderedNormalized[0]?.content ?? "",
      B: orderedNormalized[1]?.content ?? "",
      C: orderedNormalized[2]?.content ?? "",
      D: orderedNormalized[3]?.content ?? "",
      E: orderedNormalized[4]?.content ?? "",
    };

    const explanations: ExplainOptions = {
      A: orderedNormalized[0]?.explanation ?? "Sem explicacao.",
      B: orderedNormalized[1]?.explanation ?? "Sem explicacao.",
      C: orderedNormalized[2]?.explanation ?? "Sem explicacao.",
      D: orderedNormalized[3]?.explanation ?? "Sem explicacao.",
      E: orderedNormalized[4]?.explanation ?? "Nao aplicavel.",
    };

    const correctOptions = orderedNormalized
      .map((option, index) => ({ option, label: labels[index] }))
      .filter((entry) => Boolean(entry.label))
      .filter((entry) => entry.option.isCorrect)
      .map((entry) => entry.label as QuestionOption);

    return {
      options,
      explanations,
      correctOption: correctOptions[0] ?? "A",
      correctOptions: correctOptions.length > 0 ? correctOptions : ["A"],
    };
  }

  const fallbackCorrectOption = isOptionKey(question.correctOption) ? question.correctOption : "A";
  const fallbackCorrectOptions = normalizeOptionArray((question as { correctOptions?: unknown }).correctOptions);

  return {
    options: {
      A: question.optionA,
      B: question.optionB,
      C: question.optionC,
      D: question.optionD,
      E: question.optionE ?? "",
    },
    explanations: {
      A: question.explanationA ?? "Sem explicacao.",
      B: question.explanationB ?? "Sem explicacao.",
      C: question.explanationC ?? "Sem explicacao.",
      D: question.explanationD ?? "Sem explicacao.",
      E: question.explanationE ?? "Nao aplicavel.",
    },
    correctOption: fallbackCorrectOption,
    correctOptions: fallbackCorrectOptions.length > 0 ? fallbackCorrectOptions : [fallbackCorrectOption],
  };
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as Body;
  const selectedOptionsInput = normalizeOptionArray(body.selectedOptions);
  const selectedSingleInput = body.selectedOption;
  if (!body.questionId || (!selectedSingleInput && selectedOptionsInput.length === 0)) {
    return NextResponse.json({ error: "Informe questionId e selectedOption/selectedOptions." }, { status: 400 });
  }

  const question = await prisma.studyQuestion.findUnique({
    where: { id: body.questionId },
    include: {
      certificationPreset: { select: { code: true, name: true } },
      awsService: { select: { code: true, name: true } },
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
    },
  });

  if (!question) {
    return NextResponse.json({ error: "Questao nao encontrada." }, { status: 404 });
  }

  const resolvedFrame = resolveQuestionFrame(question);
  const fallbackOriginalOptions: ExplainOptions = resolvedFrame.explanations;

  const questionType = normalizeQuestionType((question as { questionType?: unknown }).questionType);
  const originalCorrectOption = resolvedFrame.correctOption;
  const originalCorrectOptions = resolvedFrame.correctOptions;
  const originalSelectedOptions =
    selectedOptionsInput.length > 0
      ? selectedOptionsInput.map((option) => toOriginalOptionFrame(option, body.optionMapping))
      : selectedSingleInput
        ? [toOriginalOptionFrame(selectedSingleInput, body.optionMapping)]
        : [];

  const displayCorrectOption = toDisplayCorrectOption(originalCorrectOption, body.optionMapping);
  const displayCorrectOptions = toDisplayCorrectOptions(originalCorrectOptions, body.optionMapping);

  if (isCacheValid(question.cachedExplainAt, question.cachedExplainVersion)) {
    const cachedOriginalOptions: ExplainOptions = {
      A: question.cachedExplainA ?? fallbackOriginalOptions.A,
      B: question.cachedExplainB ?? fallbackOriginalOptions.B,
      C: question.cachedExplainC ?? fallbackOriginalOptions.C,
      D: question.cachedExplainD ?? fallbackOriginalOptions.D,
      E: question.cachedExplainE ?? fallbackOriginalOptions.E,
    };

    return NextResponse.json({
      summary: question.cachedExplainSummary ?? "Resumo indisponivel.",
      options: toDisplayFrameOptions(cachedOriginalOptions, body.optionMapping),
      correctOption: displayCorrectOption,
      correctOptions: displayCorrectOptions,
      selectedOption: selectedSingleInput ?? originalSelectedOptions[0] ?? "A",
      selectedOptions: originalSelectedOptions,
      fromCache: true,
    });
  }

  try {
    const model = getAiModel();

    const prompt = `
Explique uma questão de certificação AWS em português (pt-BR), de forma didática e objetiva.

Contexto:
- Certificação: ${question.certificationPreset?.name ?? question.certificationPreset?.code ?? "AWS"}
- Assunto: ${question.awsService?.name ?? question.topic}
- Enunciado: ${question.statement}
- Tipo da questao: ${questionType}
- Alternativas marcadas pelo aluno: ${originalSelectedOptions.join(", ") || "nenhuma"}
- Alternativas corretas oficiais: ${originalCorrectOptions.join(", ")}

Alternativas:
A) ${resolvedFrame.options.A}
B) ${resolvedFrame.options.B}
C) ${resolvedFrame.options.C}
D) ${resolvedFrame.options.D}
E) ${resolvedFrame.options.E || "(não aplicável)"}

Regras:
- Retorne APENAS JSON válido (sem markdown).
- JSON deve conter:
{
  "summary": "resumo curto da lógica da questão",
  "options": {
    "A": "por que está certa/errada",
    "B": "por que está certa/errada",
    "C": "por que está certa/errada",
    "D": "por que está certa/errada",
    "E": "por que está certa/errada ou não aplicável"
  }
}
- Seja consistente com as alternativas corretas oficiais (${originalCorrectOptions.join(", ")}).
- Se uma alternativa não existir, explique como "nao aplicavel".
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonText = extractJsonObject(text);

    if (!jsonText) {
      throw new Error("A IA nao retornou JSON valido.");
    }

    const parsed = JSON.parse(jsonText) as {
      summary?: string;
      options?: Partial<Record<"A" | "B" | "C" | "D" | "E", string>>;
    };

    const normalizedOriginal = {
      summary: parsed.summary ?? "Resumo indisponivel.",
      options: normalizeExplainOptions(parsed.options, fallbackOriginalOptions),
    };

    await prisma.$transaction(async (tx) => {
      await tx.studyQuestion.update({
        where: { id: question.id },
        data: {
          explanationA: normalizedOriginal.options.A,
          explanationB: normalizedOriginal.options.B,
          explanationC: normalizedOriginal.options.C,
          explanationD: normalizedOriginal.options.D,
          explanationE: normalizedOriginal.options.E,
          cachedExplainSummary: normalizedOriginal.summary,
          cachedExplainA: normalizedOriginal.options.A,
          cachedExplainB: normalizedOriginal.options.B,
          cachedExplainC: normalizedOriginal.options.C,
          cachedExplainD: normalizedOriginal.options.D,
          cachedExplainE: normalizedOriginal.options.E,
          cachedExplainAt: new Date(),
          cachedExplainVersion: EXPLAIN_CACHE_VERSION,
        },
      });

      const explanationByOrder = [
        normalizedOriginal.options.A,
        normalizedOriginal.options.B,
        normalizedOriginal.options.C,
        normalizedOriginal.options.D,
        normalizedOriginal.options.E,
      ];

      for (let order = 0; order < explanationByOrder.length; order += 1) {
        await tx.questionOption.updateMany({
          where: {
            questionId: question.id,
            order,
          },
          data: {
            explanation: explanationByOrder[order],
          },
        });
      }
    });

    return NextResponse.json({
      summary: normalizedOriginal.summary,
      options: toDisplayFrameOptions(normalizedOriginal.options, body.optionMapping),
      correctOption: displayCorrectOption,
      correctOptions: displayCorrectOptions,
      selectedOption: selectedSingleInput ?? originalSelectedOptions[0] ?? "A",
      selectedOptions: originalSelectedOptions,
    });
  } catch (error) {
    const fallbackDisplayOptions = toDisplayFrameOptions(fallbackOriginalOptions, body.optionMapping);

    return NextResponse.json(
      {
        summary: "Explicacao offline usando base local.",
        options: fallbackDisplayOptions,
        correctOption: displayCorrectOption,
        correctOptions: displayCorrectOptions,
        selectedOption: selectedSingleInput ?? originalSelectedOptions[0] ?? "A",
        selectedOptions: originalSelectedOptions,
        aiError: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 200 },
    );
  }
}
