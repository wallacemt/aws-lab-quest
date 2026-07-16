import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { callAI, extractJsonObject, AiNotConfiguredError } from "@/lib/ai";
import { cacheGetOrSet, CACHE_KEYS, CACHE_TTL } from "@/lib/cache";

type RouteContext = { params: Promise<{ chainId: string; stageId: string }> };

type RawQuestion = {
  statement: string;
  options: { key: string; text: string }[];
  correctKey: string;
  explanation: string;
};

/**
 * POST /api/trails/[chainId]/stages/[stageId]/questions
 *
 * Generates 10 temporary quiz questions for a trail stage.
 * Questions are NOT persisted — they are ephemeral per session.
 *
 * Returns: { questions: TrailQuestion[] }
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { chainId, stageId } = await context.params;

  const stage = await prisma.questChainStage.findFirst({
    where: { id: stageId, chainId },
    select: {
      title: true,
      awsServiceId: true,
      topic: true,
      chain: { select: { name: true, certificationPresetId: true } },
    },
  });

  if (!stage) return NextResponse.json({ error: "Stage not found" }, { status: 404 });

  const profile = await prisma.userProfile.findUnique({
    where: { userId: session.user.id },
    select: { certificationPreset: { select: { name: true } } },
  });

  const subject = stage.awsServiceId ?? stage.topic ?? stage.title;
  const certName = profile?.certificationPreset?.name ?? "AWS";

  const prompt = `Você é um especialista em certificações AWS. Gere EXATAMENTE 10 questões de múltipla escolha sobre: **${stage.title}**${subject !== stage.title ? ` (${subject})` : ""}.

Contexto: certificação ${certName}.

Distribuição:
- 3 questões conceituais (o que é, como funciona)
- 4 questões de aplicação prática (cenários reais)
- 3 questões de troubleshooting / escolha entre serviços

Requisitos:
- 4 alternativas por questão (A, B, C, D)
- Questões diferentes entre si, cobrindo aspectos variados
- Dificuldade intermediária a avançada
- Inclua uma explicação curta e direta da resposta correta

Responda APENAS com JSON válido, sem texto antes ou depois:
{
  "questions": [
    {
      "statement": "Texto completo da questão?",
      "options": [
        {"key": "A", "text": "alternativa A"},
        {"key": "B", "text": "alternativa B"},
        {"key": "C", "text": "alternativa C"},
        {"key": "D", "text": "alternativa D"}
      ],
      "correctKey": "A",
      "explanation": "Explicação concisa de por que A está correta."
    }
  ]
}`;

  type TrailQuestion = {
    id: string;
    statement: string;
    options: { key: string; text: string }[];
    correctKey: string;
    explanation: string;
  };

  // ponytail: the model occasionally returns truncated/malformed JSON for a
  // 10-question batch — retry a couple of times before giving up, instead of
  // failing the whole request on the first flaky response.
  const MAX_ATTEMPTS = 3;

  let questions: TrailQuestion[];
  try {
    questions = await cacheGetOrSet<TrailQuestion[]>(
      CACHE_KEYS.trailQuestions(stageId),
      async () => {
        let lastError: unknown;
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
          try {
            const rawText = (await callAI(prompt, "TRAIL_QUESTION_GENERATION")).trim();

            const jsonStr = extractJsonObject(rawText);
            if (!jsonStr) throw new Error("Resposta da IA não é JSON válido.");

            const parsed = JSON.parse(jsonStr) as { questions?: RawQuestion[] };
            if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
              throw new Error("Nenhuma questão gerada.");
            }

            return parsed.questions.slice(0, 10).map((q, i) => ({
              id: `trail-q-${stageId}-${i}`,
              statement: q.statement ?? "",
              options: Array.isArray(q.options) ? q.options : [],
              correctKey: (q.correctKey ?? "A").toUpperCase(),
              explanation: q.explanation ?? "",
            }));
          } catch (err) {
            lastError = err;
          }
        }
        throw lastError instanceof Error ? lastError : new Error("Resposta da IA não é JSON válido.");
      },
      CACHE_TTL.TRAIL_QUESTIONS,
    );
  } catch (err) {
    const status = err instanceof AiNotConfiguredError ? 503 : 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro desconhecido" },
      { status },
    );
  }

  return NextResponse.json({ questions });
}
