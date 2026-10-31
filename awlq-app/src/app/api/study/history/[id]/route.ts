import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireApprovedUser } from "@/lib/user-auth";
import { prisma } from "@/lib/prisma";
import { QuestionOption } from "@/lib/types";
import { readJsonWithBodyLimit } from "@/lib/study-snapshot";

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
      result[key] = value.trim();
    }
  }

  return result;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireApprovedUser(request);
  if (auth.response) return auth.response;

  const params = await context.params;
  const historyId = params.id?.trim();

  if (!historyId) {
    return NextResponse.json({ error: "ID de historico invalido." }, { status: 400 });
  }

  const item = await prisma.studySessionHistory.findFirst({
    where: {
      id: historyId,
      userId: auth.user.id,
    },
  });

  if (!item) {
    return NextResponse.json({ error: "Sessao de estudo nao encontrada." }, { status: 404 });
  }

  return NextResponse.json({ item });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireApprovedUser(request);
  if (auth.response) return auth.response;

  const params = await context.params;
  const historyId = params.id?.trim();

  if (!historyId) {
    return NextResponse.json({ error: "ID de historico invalido." }, { status: 400 });
  }

  const parsed = await readJsonWithBodyLimit(request);
  if (parsed.error === "too-large") {
    return NextResponse.json({ error: "Request body exceeds 1 MB." }, { status: 413 });
  }
  if (parsed.error || !parsed.body || typeof parsed.body !== "object" || Array.isArray(parsed.body)) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const body = parsed.body as PatchBody;
  const questionId = body.questionId?.trim();
  const explanationSummary = body.explanationSummary?.trim();

  if (typeof body.explanationSummary === "string" && body.explanationSummary.length > 8 * 1024) {
    return NextResponse.json({ error: "Snapshot field exceeds its limit: explanationSummary." }, { status: 400 });
  }
  if (body.explanations && typeof body.explanations === "object") {
    for (const [key, explanation] of Object.entries(body.explanations)) {
      if (typeof explanation === "string" && explanation.length > 4 * 1024) {
      return NextResponse.json({ error: `Snapshot field exceeds its limit: explanations.${key}.` }, { status: 400 });
      }
    }
  }
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
      userId: auth.user.id,
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
