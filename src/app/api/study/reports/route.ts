import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VALID_REASONS = new Set([
  "INCORRECT_ANSWER",
  "UNCLEAR_STATEMENT",
  "MISSING_CONTEXT",
  "GRAMMAR_TYPO",
  "DUPLICATE",
  "QUALITY_ISSUE",
  "OTHER",
]);

type Body = {
  questionId?: string;
  reason?: string;
  description?: string;
};

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as Body;
  const questionId = body.questionId?.trim();
  const reason = body.reason?.trim().toUpperCase();
  const description = body.description?.trim() ?? "";

  if (!questionId || !reason) {
    return NextResponse.json({ error: "Informe questionId e reason." }, { status: 400 });
  }

  if (!VALID_REASONS.has(reason)) {
    return NextResponse.json({ error: "Motivo de denuncia invalido." }, { status: 400 });
  }

  const question = await prisma.studyQuestion.findUnique({
    where: { id: questionId },
    select: { id: true },
  });

  if (!question) {
    return NextResponse.json({ error: "Questao nao encontrada." }, { status: 404 });
  }

  const duplicateWindowStart = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const alreadyReported = await prisma.questionReport.findFirst({
    where: {
      questionId,
      userId: session.user.id,
      reportedAt: {
        gte: duplicateWindowStart,
      },
    },
    select: { id: true },
  });

  if (alreadyReported) {
    return NextResponse.json(
      {
        error: "Voce ja denunciou esta questao nas ultimas 24h. Aguarde a triagem do admin.",
      },
      { status: 429 },
    );
  }

  const report = await prisma.questionReport.create({
    data: {
      questionId,
      userId: session.user.id,
      reason: reason as
        | "INCORRECT_ANSWER"
        | "UNCLEAR_STATEMENT"
        | "MISSING_CONTEXT"
        | "GRAMMAR_TYPO"
        | "DUPLICATE"
        | "QUALITY_ISSUE"
        | "OTHER",
      description: description.length > 0 ? description.slice(0, 500) : null,
      status: "OPEN",
    },
    select: {
      id: true,
      questionId: true,
      reason: true,
      status: true,
      reportedAt: true,
    },
  });

  await prisma.studyQuestion.update({
    where: { id: questionId },
    data: {
      flaggedAt: new Date(),
      flaggedReason: reason,
    },
  });

  return NextResponse.json({ report }, { status: 201 });
}
