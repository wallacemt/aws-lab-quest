/**
 * KC Question Builder (ADR-03, RF-15).
 *
 * Generates Knowledge Check questions using a simpler, review-focused prompt.
 * Distinct from the main question-generation.worker to keep concerns separated:
 * - Shorter, concept-verification prompts (not full exam scenarios)
 * - Difficulty-aware generation
 * - Questions marked usage: KC
 * - Reuses shared/ingestion-pipeline.ts for dedup and persistence
 */

import { callAI } from "../ai.js";
import {
  ParsedQuestion,
  extractJsonArray,
  persistQuestion,
  validateQuestion,
} from "../shared/ingestion-pipeline.js";
import { logger } from "../shared/logger.js";
import { prisma } from "../prisma.js";

export type KcBuildOptions = {
  requestId: string;
  userId: string;
  certificationPresetId?: string;
  serviceCode?: string;
  topic?: string;
  difficulty: "easy" | "medium" | "hard" | "nightmare";
  count: number;
};

export type KcBuildResult = {
  savedCount: number;
  duplicateCount: number;
  rejectedCount: number;
};

function buildKcPrompt(options: KcBuildOptions): string {
  const subject = options.serviceCode
    ? `AWS service: ${options.serviceCode}`
    : `topic: ${options.topic ?? "AWS General"}`;

  return `Você é um gerador de questões de Knowledge Check (KC) para preparação de certificações AWS.

Alvo: ${subject}
Total: ${options.count} questões
Idioma: Português Brasileiro (pt-BR) — enunciados, opções e explicações DEVEM estar em pt-BR.

Requisitos:
- Questões devem verificar conhecimento específico de AWS, não apenas memorização
- Varie o tipo: a maioria "single" (1 opção correta), inclua 1-2 "multi" (múltiplas opções corretas) quando adequado
- Varie a dificuldade ao longo do lote: aproximadamente 30% easy, 50% medium, 20% hard
- Questões "single": exatamente 4 opções, apenas 1 correta
- Questões "multi": 4-5 opções, 2-3 corretas
- Inclua explicação clara para cada opção correta
- Enunciados concisos (máx. 3 frases)
- Foque em conceitos que o estudante deve ENTENDER, não memorizar

Retorne um array JSON:
[
  {
    "statement": "...",
    "topic": "${options.topic ?? options.serviceCode ?? "AWS"}",
    "questionType": "single",
    "options": [
      { "content": "...", "isCorrect": false, "explanation": "..." },
      { "content": "...", "isCorrect": true,  "explanation": "..." },
      { "content": "...", "isCorrect": false, "explanation": "..." },
      { "content": "...", "isCorrect": false, "explanation": "..." }
    ],
    "awsServices": ["${options.serviceCode ?? ""}"],
    "difficulty": "easy"
  }
]

Retorne APENAS o array JSON. Sem markdown, sem explicação, sem raciocínio, sem preâmbulo.`;
}

/**
 * Generates KC questions for a given service/topic and persists them.
 * Marks all generated questions with `usage: KC`.
 */
export async function buildKcQuestions(options: KcBuildOptions): Promise<KcBuildResult> {
  const prompt = buildKcPrompt(options);

  let rawResponse: string;
  try {
    rawResponse = await callAI(prompt, "WORKER_KC_QUESTION");
  } catch (err) {
    logger.error({ requestId: options.requestId, err }, "kc-question-builder: AI call failed");
    throw err;
  }

  const jsonText = extractJsonArray(rawResponse);
  if (!jsonText) {
    logger.warn({ requestId: options.requestId }, "kc-question-builder: no JSON array in response");
    return { savedCount: 0, duplicateCount: 0, rejectedCount: 0 };
  }

  let parsed: ParsedQuestion[];
  try {
    const raw = JSON.parse(jsonText) as unknown;
    parsed = Array.isArray(raw) ? (raw as ParsedQuestion[]) : [];
  } catch {
    logger.warn(
      { requestId: options.requestId, snippet: jsonText.slice(0, 200) },
      "kc-question-builder: invalid JSON",
    );
    return { savedCount: 0, duplicateCount: 0, rejectedCount: 0 };
  }

  // Use a synthetic certificationCode for externalId prefix. No cert context in KC.
  const certCode = options.serviceCode ?? options.topic ?? "KC";

  let savedCount = 0;
  let duplicateCount = 0;
  let rejectedCount = 0;

  for (const question of parsed.slice(0, options.count)) {
    const validation = validateQuestion(question);
    if (!validation.valid) {
      logger.warn(
        { reason: validation.reason, question: JSON.stringify(question).slice(0, 300) },
        "kc-question-builder: rejected question",
      );
      rejectedCount += 1;
      continue;
    }

    const result = await persistQuestion(question, options.certificationPresetId ?? null, certCode, "KC");

    if (result.saved) savedCount += 1;
    else if (result.reason === "duplicate") duplicateCount += 1;
    else {
      logger.warn(
        { requestId: options.requestId, reason: result.reason, detail: (result as { detail?: string }).detail },
        "kc-question-builder: persist failed",
      );
      rejectedCount += 1;
    }
  }

  logger.info(
    { requestId: options.requestId, savedCount, duplicateCount, rejectedCount },
    "kc-question-builder: done",
  );

  return { savedCount, duplicateCount, rejectedCount };
}
