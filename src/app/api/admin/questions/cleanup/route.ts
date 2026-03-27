import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

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
    },
  });

  const irregularIds: string[] = [];
  const reasonsById: Record<string, string[]> = {};

  for (const question of questions) {
    const reasons: string[] = [];

    if (isPlaceholder(question.statement) || question.statement.trim().length < 20) {
      reasons.push("statement_invalido");
    }

    if (isPlaceholder(question.topic)) {
      reasons.push("topic_invalido");
    }

    const optionA = question.optionA?.trim() ?? "";
    const optionB = question.optionB?.trim() ?? "";
    const optionC = question.optionC?.trim() ?? "";
    const optionD = question.optionD?.trim() ?? "";
    const optionE = question.optionE?.trim() ?? "";

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

    const correctOption = normalizeOption(question.correctOption);
    if (!isOptionLabel(correctOption) || isPlaceholder(optionsByLabel[correctOption])) {
      reasons.push("gabarito_principal_invalido");
    }

    const correctOptionsRaw = Array.isArray(question.correctOptions)
      ? (question.correctOptions as unknown[])
      : [correctOption];

    const validCorrectOptions = Array.from(
      new Set(
        correctOptionsRaw
          .map((value) => normalizeOption(value))
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
      isPlaceholder(question.explanationA) ||
      isPlaceholder(question.explanationB) ||
      isPlaceholder(question.explanationC) ||
      isPlaceholder(question.explanationD)
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
