import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { callAIWithSystem, AiNotConfiguredError } from "@/lib/ai";

const MAX_QUESTION_LENGTH = 500;
const WINDOW_MS = 24 * 60 * 60 * 1000; // rolling 24-hour window

// System instruction kept separate from user content so the model never
// confuses its own role description with the question being asked.
const MENTOR_SYSTEM_INSTRUCTION =
  "Você é um mentor conciso de certificação AWS chamado Mestre AWS. " +
  "Responda SEMPRE em Português (Brasil). " +
  "Responda DIRETAMENTE à pergunta do usuário — sem repetir suas instruções, " +
  "sem expor seu raciocínio interno, sem introduções sobre seu papel. " +
  "Use Markdown simples: negrito, listas, cabeçalhos quando útil. " +
  "Não use notação LaTeX ($...$) — use o símbolo Unicode diretamente (ex: →, ≥, ≤). " +
  "Limite: 300 palavras.";

// ponytail: inlined — no reason to keep a wrapper around a single call site


// Fallback: replace residual LaTeX arrow notation the model may still emit.
function sanitizeAnswer(text: string): string {
  return text
    .replace(/\$\\rightarrow\$/g, "→")
    .replace(/\$\\leftarrow\$/g, "←")
    .replace(/\$\\Rightarrow\$/g, "⇒")
    .replace(/\$\\leq\$/g, "≤")
    .replace(/\$\\geq\$/g, "≥");
}

/**
 * GET /api/mentor/ask
 *
 * Returns whether the user can ask a mentor question without consuming the limit.
 * Uses a rolling 24-hour window (not UTC calendar day).
 */
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { lastMentorQuestionAt: true, lastMentorQuestion: true, lastMentorAnswer: true },
  });

  const lastAsked = user?.lastMentorQuestionAt ?? null;
  const cutoff = new Date(Date.now() - WINDOW_MS);
  const canAsk = !lastAsked || lastAsked < cutoff;
  const resetsAt = canAsk
    ? null
    : new Date(lastAsked!.getTime() + WINDOW_MS).toISOString();

  return NextResponse.json({
    canAsk,
    resetsAt,
    lastQuestion: user?.lastMentorQuestion ?? null,
    lastAnswer: user?.lastMentorAnswer ?? null,
  });
}

/**
 * POST /api/mentor/ask
 *
 * Enforces a 1-question-per-rolling-24h limit using an atomic `updateMany`
 * reservation. The slot is consumed before calling AI so concurrent requests
 * cannot both pass the gate (DEF-001/002). A failed AI call still counts
 * against the limit to prevent re-exploit (DEF-006).
 *
 * Body: { question: string }
 * 200: { answer: string, resetsAt: string }
 * 400: { error: string }       — invalid input
 * 401: { error: "Unauthorized" }
 * 429: { error: "daily_limit", resetsAt: string }
 * 502: { error: string }       — AI failure
 */
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 1. Validate input BEFORE reserving the slot — invalid requests must never
  //    consume the daily limit.
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

  // 2. Read the current slot value before reserving — needed to restore on AI failure.
  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { lastMentorQuestionAt: true },
  });

  // 3. Atomically reserve the slot: succeeds only if no question was asked in
  //    the last 24h. This eliminates the check-then-write race (DEF-001).
  const cutoff = new Date(Date.now() - WINDOW_MS);
  const reservation = await prisma.user.updateMany({
    where: {
      id: session.user.id,
      OR: [
        { lastMentorQuestionAt: null },
        { lastMentorQuestionAt: { lt: cutoff } },
      ],
    },
    data: { lastMentorQuestionAt: new Date() },
  });

  if (reservation.count === 0) {
    // Slot already taken (concurrent request won or limit already used today).
    const resetsAt = currentUser?.lastMentorQuestionAt
      ? new Date(currentUser.lastMentorQuestionAt.getTime() + WINDOW_MS).toISOString()
      : new Date(Date.now() + WINDOW_MS).toISOString();
    return NextResponse.json({ error: "daily_limit", resetsAt }, { status: 429 });
  }

  // 4. Slot is reserved — call AI.
  //    On failure, restore the previous value so the user can retry.
  //    The restore is best-effort: if it fails, the slot stays consumed (acceptable).
  let answer: string;
  try {
    answer = sanitizeAnswer(
      await callAIWithSystem(question, "QUESTION_EXPLAIN", MENTOR_SYSTEM_INSTRUCTION),
    );
  } catch (err) {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { lastMentorQuestionAt: currentUser?.lastMentorQuestionAt ?? null },
    }).catch(() => {});
    const status = err instanceof AiNotConfiguredError ? 503 : 502;
    const message = err instanceof Error ? err.message : "Erro desconhecido.";
    return NextResponse.json({ error: `Falha ao contatar o Mestre: ${message}` }, { status });
  }

  // 5. Persist the Q&A so the user can read it again when they revisit the page.
  await prisma.user.update({
    where: { id: session.user.id },
    data: { lastMentorQuestion: question, lastMentorAnswer: answer },
  }).catch(() => {});

  const resetsAt = new Date(Date.now() + WINDOW_MS).toISOString();
  return NextResponse.json({ answer, resetsAt });
}
