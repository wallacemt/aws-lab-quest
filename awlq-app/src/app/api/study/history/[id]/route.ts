import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { QuestionOption } from "@/lib/types";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type SnapshotAnswer = {
  questionId?: string;
  explanations?: Partial<Record<QuestionOption, string>>;
  explanationSummary?: string;
  [key: string]: unknown;
};

type PatchBody = {
  questionId?: string;
  explanationSummary?: string;
  explanations?: Partial<Record<QuestionOption, string>>;
};

function isOptionKey(value: string): value is QuestionOption {
  return value === "A" || value === "B" || value === "C" || value === "D" || value === "E";
}

function normalizeExplanations(input: unknown): Partial<Record<QuestionOption, string>> {
  if (!input || typeof input !== "object") {
    return {};
  }

  const source = input as Record<string, unknown>;
  const result: Partial<Record<QuestionOption, string>> = {};

  for (const [key, value] of Object.entries(source)) {
    if (!isOptionKey(key)) {
      continue;
    }

    if (typeof value === "string" && value.trim().length > 0) {
      result[key] = value.trim().slice(0, 2000);
    }
  }

  return result;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await context.params;
  const historyId = params.id?.trim();

  if (!historyId) {
    return NextResponse.json({ error: "ID de historico invalido." }, { status: 400 });
  }

  const item = await prisma.studySessionHistory.findFirst({
    where: {
      id: historyId,
      userId: session.user.id,
    },
  });

  if (!item) {
    return NextResponse.json({ error: "Sessao de estudo nao encontrada." }, { status: 404 });
  }

  return NextResponse.json({ item });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await context.params;
  const historyId = params.id?.trim();

  if (!historyId) {
    return NextResponse.json({ error: "ID de historico invalido." }, { status: 400 });
  }

  const body = (await request.json()) as PatchBody;
  const questionId = body.questionId?.trim();
  const explanationSummary = body.explanationSummary?.trim();
  const explanations = normalizeExplanations(body.explanations);

  if (!questionId) {
    return NextResponse.json({ error: "questionId e obrigatorio." }, { status: 400 });
  }

  if (!explanationSummary && Object.keys(explanations).length === 0) {
    return NextResponse.json({ error: "Nenhum dado de explicacao informado." }, { status: 400 });
  }

  const item = await prisma.studySessionHistory.findFirst({
    where: {
      id: historyId,
      userId: session.user.id,
    },
    select: {
      id: true,
      answersSnapshot: true,
    },
  });

  if (!item) {
    return NextResponse.json({ error: "Sessao de estudo nao encontrada." }, { status: 404 });
  }

  if (!Array.isArray(item.answersSnapshot)) {
    return NextResponse.json({ error: "Snapshot de respostas invalido." }, { status: 409 });
  }

  let changed = false;
  const updatedSnapshot = (item.answersSnapshot as SnapshotAnswer[]).map((answer) => {
    if (answer.questionId !== questionId) {
      return answer;
    }

    changed = true;
    return {
      ...answer,
      explanationSummary: explanationSummary ?? answer.explanationSummary,
      explanations: {
        ...(answer.explanations ?? {}),
        ...explanations,
      },
    };
  });

  if (!changed) {
    return NextResponse.json({ error: "Questao nao encontrada no snapshot deste historico." }, { status: 404 });
  }

  const updated = await prisma.studySessionHistory.update({
    where: {
      id: historyId,
    },
    data: {
      answersSnapshot: updatedSnapshot as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({ item: updated });
}
