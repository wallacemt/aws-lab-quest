import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAiModel, extractJsonObject } from "@/lib/ai";
import { prisma } from "@/lib/prisma";
import { QuestionOption, QuestionOptionMapping } from "@/lib/types";

type Body = {
  questionId?: string;
  selectedOption?: QuestionOption;
  optionMapping?: QuestionOptionMapping;
};

type ExplainOptions = Record<QuestionOption, string>;

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

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as Body;
  if (!body.questionId || !body.selectedOption) {
    return NextResponse.json({ error: "Informe questionId e selectedOption." }, { status: 400 });
  }

  const question = await prisma.studyQuestion.findUnique({
    where: { id: body.questionId },
    include: {
      certificationPreset: { select: { code: true, name: true } },
      awsService: { select: { code: true, name: true } },
    },
  });

  if (!question) {
    return NextResponse.json({ error: "Questao nao encontrada." }, { status: 404 });
  }

  const fallbackOriginalOptions: ExplainOptions = {
    A: question.explanationA ?? "Sem explicacao.",
    B: question.explanationB ?? "Sem explicacao.",
    C: question.explanationC ?? "Sem explicacao.",
    D: question.explanationD ?? "Sem explicacao.",
    E: question.explanationE ?? "Nao aplicavel.",
  };

  const originalCorrectOption = isOptionKey(question.correctOption) ? question.correctOption : "A";
  const originalSelectedOption = toOriginalOptionFrame(body.selectedOption, body.optionMapping);
  const displayCorrectOption = toDisplayCorrectOption(originalCorrectOption, body.optionMapping);

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
      selectedOption: body.selectedOption,
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
- Alternativa marcada pelo aluno: ${originalSelectedOption}
- Alternativa correta oficial: ${originalCorrectOption}

Alternativas:
A) ${question.optionA}
B) ${question.optionB}
C) ${question.optionC}
D) ${question.optionD}
E) ${question.optionE ?? "(não aplicável)"}

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
- Seja consistente com a alternativa correta oficial (${originalCorrectOption}).
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

    await prisma.studyQuestion.update({
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

    return NextResponse.json({
      summary: normalizedOriginal.summary,
      options: toDisplayFrameOptions(normalizedOriginal.options, body.optionMapping),
      correctOption: displayCorrectOption,
      selectedOption: body.selectedOption,
    });
  } catch (error) {
    const fallbackDisplayOptions = toDisplayFrameOptions(fallbackOriginalOptions, body.optionMapping);

    return NextResponse.json(
      {
        summary: "Explicacao offline usando base local.",
        options: fallbackDisplayOptions,
        correctOption: displayCorrectOption,
        selectedOption: body.selectedOption,
        aiError: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 200 },
    );
  }
}
