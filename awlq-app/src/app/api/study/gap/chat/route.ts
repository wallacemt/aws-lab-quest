import { NextRequest, NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/user-auth";
import { prisma } from "@/lib/prisma";
import { AiNotConfiguredError, callAIWithSystem } from "@/lib/ai";
import { checkRateLimit } from "@/lib/rate-limit";

const MAX_MESSAGE_LENGTH = 500;

type ChatTurn = { role: "user" | "assistant"; content: string };

type Body = {
  message?: unknown;
  questionId?: unknown;
  history?: unknown;
};

function toHistory(value: unknown): ChatTurn[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item): item is ChatTurn =>
        item &&
        (item.role === "user" || item.role === "assistant") &&
        typeof item.content === "string",
    )
    .slice(-6)
    .map((item) => ({ role: item.role, content: item.content.slice(0, MAX_MESSAGE_LENGTH) }));
}

/**
 * POST /api/study/gap/chat
 *
 * RAG-simples chat scoped to a single wrong question + service (EPIC-03 #19).
 * The client only identifies the question by id — LSF-2026-207: the question
 * statement, correct answer, and service name that go into the system prompt
 * are always looked up server-side, never taken from the request body.
 */
export async function POST(request: NextRequest) {
  const auth = await requireApprovedUser(request);
  if (auth.response) return auth.response;

  // LSF-2026-209: throttle AI chat per user
  const limited = await checkRateLimit(auth.user.id, "study-gap-chat", 15, 60);
  if (limited) return limited;

  const body = (await request.json().catch(() => null)) as Body | null;
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const questionId = typeof body?.questionId === "string" ? body.questionId : "";

  if (!message) {
    return NextResponse.json({ error: "A mensagem não pode estar vazia." }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `A mensagem deve ter no máximo ${MAX_MESSAGE_LENGTH} caracteres.` },
      { status: 400 },
    );
  }
  if (!questionId) {
    return NextResponse.json({ error: "questionId é obrigatório." }, { status: 400 });
  }

  const question = await prisma.studyQuestion.findUnique({
    where: { id: questionId },
    select: {
      statement: true,
      correctOption: true,
      topic: true,
      questionAwsServices: { select: { service: { select: { name: true } } } },
    },
  });

  if (!question) {
    return NextResponse.json({ error: "Questão não encontrada." }, { status: 404 });
  }

  const serviceName = question.questionAwsServices?.[0]?.service?.name ?? question.topic ?? "AWS";
  const history = toHistory(body?.history);

  const systemInstruction = [
    `Você é um especialista em ${serviceName} da AWS, ajudando um aluno a entender uma questão que ele errou.`,
    "Responda SEMPRE em Português (Brasil), de forma direta e didática.",
    "Restrinja-se ao contexto da questão abaixo — não divague para outros serviços.",
    "Use Markdown simples (negrito, listas). Limite: 250 palavras.",
    "",
    `Questão: ${question.statement}`,
    `Resposta correta: ${question.correctOption}`,
  ].join("\n");

  const conversation = [...history.map((h) => `${h.role === "user" ? "Aluno" : "Especialista"}: ${h.content}`), `Aluno: ${message}`].join(
    "\n\n",
  );

  try {
    const answer = await callAIWithSystem(conversation, "QUESTION_EXPLAIN", systemInstruction);
    return NextResponse.json({ answer });
  } catch (err) {
    // LSF-2026-208: never forward the raw provider error (can include quota/org details) to the client.
    console.error("[study/gap/chat] AI failure:", err);
    const status = err instanceof AiNotConfiguredError ? 503 : 502;
    return NextResponse.json({ error: "Falha ao contatar o especialista. Tente novamente." }, { status });
  }
}
