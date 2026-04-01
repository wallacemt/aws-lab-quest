import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

type OptionLabel = "A" | "B" | "C" | "D" | "E";

type CleanupQuestionItem = {
  id: string;
  externalId: string;
  statement: string;
  topic: string;
  questionType: "single" | "multi";
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
  questionOptions: Array<{
    order: number;
    content: string;
    isCorrect: boolean;
    explanation: string | null;
  }>;
};

type CleanupResolvedFrame = {
  options: Record<OptionLabel, string>;
  explanations: Record<OptionLabel, string | null>;
  correctOptions: OptionLabel[];
};

function isPlaceholder(value: string | null | undefined): boolean {
  if (!value) {
    return true;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return normalized === "..." || normalized === "null" || normalized === "undefined" || normalized === "n/a";
}

function normalizeOption(value: unknown): string {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function isOptionLabel(value: string): value is "A" | "B" | "C" | "D" | "E" {
  return value === "A" || value === "B" || value === "C" || value === "D" || value === "E";
}

function resolveCleanupFrame(question: CleanupQuestionItem): CleanupResolvedFrame {
  const labels: OptionLabel[] = ["A", "B", "C", "D", "E"];
  const orderedNormalized = [...(question.questionOptions ?? [])].sort((a, b) => a.order - b.order).slice(0, 5);

  if (orderedNormalized.length >= 2) {
    const options: Record<OptionLabel, string> = {
      A: orderedNormalized[0]?.content?.trim() ?? "",
      B: orderedNormalized[1]?.content?.trim() ?? "",
      C: orderedNormalized[2]?.content?.trim() ?? "",
      D: orderedNormalized[3]?.content?.trim() ?? "",
      E: orderedNormalized[4]?.content?.trim() ?? "",
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
      .filter((entry) => Boolean(entry.label))
      .filter((entry) => entry.option.isCorrect)
      .map((entry) => entry.label as OptionLabel);

    return {
      options,
      explanations,
      correctOptions,
    };
  }

  const legacyCorrectOption = normalizeOption(question.correctOption);
  const legacyCorrectOptionsRaw = Array.isArray(question.correctOptions)
    ? (question.correctOptions as unknown[])
    : [legacyCorrectOption];
  const correctOptions = Array.from(
    new Set(
      legacyCorrectOptionsRaw
        .map((value) => normalizeOption(value))
        .filter((value): value is OptionLabel => isOptionLabel(value)),
    ),
  );

  return {
    options: {
      A: question.optionA?.trim() ?? "",
      B: question.optionB?.trim() ?? "",
      C: question.optionC?.trim() ?? "",
      D: question.optionD?.trim() ?? "",
      E: question.optionE?.trim() ?? "",
    },
    explanations: {
      A: question.explanationA,
      B: question.explanationB,
      C: question.explanationC,
      D: question.explanationD,
      E: question.explanationE,
    },
    correctOptions,
  };
}

export async function POST(request: NextRequest) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  const body = (await request.json().catch(() => ({}))) as { dryRun?: boolean; limit?: number };
  const dryRun = Boolean(body.dryRun);
  const limit = Math.max(100, Math.min(10000, Number(body.limit ?? 4000)));

  const questions = await prisma.studyQuestion.findMany({
    take: limit,
    select: {
      id: true,
      externalId: true,
      statement: true,
      topic: true,
      questionType: true,
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

  const irregularIds: string[] = [];
  const reasonsById: Record<string, string[]> = {};

  for (const question of questions as CleanupQuestionItem[]) {
    const reasons: string[] = [];

    if (isPlaceholder(question.statement) || question.statement.trim().length < 20) {
      reasons.push("statement_invalido");
    }

    if (isPlaceholder(question.topic)) {
      reasons.push("topic_invalido");
    }

    const resolved = resolveCleanupFrame(question);
    const optionA = resolved.options.A;
    const optionB = resolved.options.B;
    const optionC = resolved.options.C;
    const optionD = resolved.options.D;
    const optionE = resolved.options.E;

    if ([optionA, optionB, optionC, optionD].some((value) => isPlaceholder(value))) {
      reasons.push("alternativas_A_D_invalidas");
    }

    if (optionE && isPlaceholder(optionE)) {
      reasons.push("alternativa_E_invalida");
    }

    const optionsByLabel: Record<"A" | "B" | "C" | "D" | "E", string> = {
      A: optionA,
      B: optionB,
      C: optionC,
      D: optionD,
      E: optionE,
    };

    const correctOption = resolved.correctOptions[0] ?? normalizeOption(question.correctOption);
    if (!isOptionLabel(correctOption) || isPlaceholder(optionsByLabel[correctOption])) {
      reasons.push("gabarito_principal_invalido");
    }

    const validCorrectOptions = Array.from(
      new Set(
        resolved.correctOptions
          .filter((value): value is "A" | "B" | "C" | "D" | "E" => isOptionLabel(value))
          .filter((value) => !isPlaceholder(optionsByLabel[value])),
      ),
    );

    if (validCorrectOptions.length === 0) {
      reasons.push("correct_options_invalidas");
    }

    if (question.questionType === "multi" && validCorrectOptions.length < 2) {
      reasons.push("multi_sem_multiplas_respostas");
    }

    if (
      isPlaceholder(resolved.explanations.A) ||
      isPlaceholder(resolved.explanations.B) ||
      isPlaceholder(resolved.explanations.C) ||
      isPlaceholder(resolved.explanations.D)
    ) {
      reasons.push("explicacao_incompleta");
    }

    if (reasons.length > 0) {
      irregularIds.push(question.id);
      reasonsById[question.id] = reasons;
    }
  }

  let removedCount = 0;
  if (!dryRun && irregularIds.length > 0) {
    const result = await prisma.studyQuestion.deleteMany({
      where: {
        id: {
          in: irregularIds,
        },
      },
    });
    removedCount = result.count;
  }

  return NextResponse.json({
    scanned: questions.length,
    irregularCount: irregularIds.length,
    removedCount,
    dryRun,
    sample: questions
      .filter((item) => irregularIds.includes(item.id))
      .slice(0, 20)
      .map((item) => ({
        id: item.id,
        externalId: item.externalId,
        reasons: reasonsById[item.id] ?? [],
      })),
  });
}
