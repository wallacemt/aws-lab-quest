import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { AiNotConfiguredError, callAIWithSystem } from "@/lib/ai";

const MAX_MESSAGE_LENGTH = 500;
const MAX_CONTEXT_LENGTH = 4000;

type ChatTurn = { role: "user" | "assistant"; content: string };

type Body = {
  message?: unknown;
  serviceName?: unknown;
  questionStatement?: unknown;
  correctAnswerText?: unknown;
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
 * The client passes the question context on every call — no server-side
 * question lookup, no persisted conversation, context stays out of the
 * system prompt's control.
 */
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Body | null;
  const message = typeof body?.message === "string" ? body.message.trim() : "";

  if (!message) {
    return NextResponse.json({ error: "A mensagem não pode estar vazia." }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `A mensagem deve ter no máximo ${MAX_MESSAGE_LENGTH} caracteres.` },
      { status: 400 },
    );
  }

  const serviceName = typeof body?.serviceName === "string" ? body.serviceName.slice(0, 100) : "AWS";
  const questionStatement =
    typeof body?.questionStatement === "string" ? body.questionStatement.slice(0, MAX_CONTEXT_LENGTH) : "";
  const correctAnswerText =
    typeof body?.correctAnswerText === "string" ? body.correctAnswerText.slice(0, MAX_CONTEXT_LENGTH) : "";
  const history = toHistory(body?.history);

  const systemInstruction = [
    `Você é um especialista em ${serviceName} da AWS, ajudando um aluno a entender uma questão que ele errou.`,
    "Responda SEMPRE em Português (Brasil), de forma direta e didática.",
    "Restrinja-se ao contexto da questão abaixo — não divague para outros serviços.",
    "Use Markdown simples (negrito, listas). Limite: 250 palavras.",
    "",
    `Questão: ${questionStatement}`,
    `Resposta correta: ${correctAnswerText}`,
  ].join("\n");

  const conversation = [...history.map((h) => `${h.role === "user" ? "Aluno" : "Especialista"}: ${h.content}`), `Aluno: ${message}`].join(
    "\n\n",
  );

  try {
    const answer = await callAIWithSystem(conversation, "QUESTION_EXPLAIN", systemInstruction);
    return NextResponse.json({ answer });
  } catch (err) {
    const status = err instanceof AiNotConfiguredError ? 503 : 502;
    const detail = err instanceof Error ? err.message : "Erro desconhecido.";
    return NextResponse.json({ error: `Falha ao contatar o especialista: ${detail}` }, { status });
  }
}
