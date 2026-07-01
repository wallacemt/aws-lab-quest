import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAiModel } from "@/lib/ai";

const MAX_QUESTION_LENGTH = 500;

const MENTOR_PROMPT_PREFIX =
  "Você é um mentor conciso de certificação AWS. " +
  "Responda em Português (Brasil). " +
  "Mantenha respostas com no máximo 300 palavras. " +
  "Pergunta do usuário: ";

function nextMidnightUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

function isToday(date: Date): boolean {
  const now = new Date();
  return (
    date.getUTCFullYear() === now.getUTCFullYear() &&
    date.getUTCMonth() === now.getUTCMonth() &&
    date.getUTCDate() === now.getUTCDate()
  );
}

/**
 * GET /api/mentor/ask
 *
 * Returns whether the user can ask a mentor question today without consuming the limit.
 */
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { lastMentorQuestionAt: true },
  });

  const lastAsked = user?.lastMentorQuestionAt;
  if (lastAsked && isToday(lastAsked)) {
    return NextResponse.json({ canAsk: false, resetsAt: nextMidnightUTC().toISOString() });
  }

  return NextResponse.json({ canAsk: true, resetsAt: null });
}

/**
 * POST /api/mentor/ask
 *
 * Enforces the 1-question-per-day limit, calls Gemini, and records usage.
 *
 * Body: { question: string }
 * 200: { answer: string, resetsAt: string }
 * 429: { error: "daily_limit", resetsAt: string }
 */
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Server-side rate check
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { lastMentorQuestionAt: true },
  });

  if (user?.lastMentorQuestionAt && isToday(user.lastMentorQuestionAt)) {
    return NextResponse.json(
      { error: "daily_limit", resetsAt: nextMidnightUTC().toISOString() },
      { status: 429 },
    );
  }

  // Input validation
  let question: string;
  try {
    const body = (await request.json()) as { question?: unknown };
    question = typeof body.question === "string" ? body.question.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!question) {
    return NextResponse.json({ error: "A pergunta não pode estar vazia." }, { status: 400 });
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return NextResponse.json(
      { error: `A pergunta deve ter no máximo ${MAX_QUESTION_LENGTH} caracteres.` },
      { status: 400 },
    );
  }

  // Call Gemini
  let answer: string;
  try {
    const model = getAiModel();
    const result = await model.generateContent(MENTOR_PROMPT_PREFIX + question);
    answer = result.response.text();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido.";
    return NextResponse.json({ error: `Falha ao contatar o Mestre: ${message}` }, { status: 502 });
  }

  // Record usage — fire-and-forget DB failure shouldn't block the answer
  await prisma.user.update({
    where: { id: session.user.id },
    data: { lastMentorQuestionAt: new Date() },
  });

  const resetsAt = nextMidnightUTC().toISOString();
  return NextResponse.json({ answer, resetsAt });
}
