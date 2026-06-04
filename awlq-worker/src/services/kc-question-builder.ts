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

import { callGemini } from "../ai.js";
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

  const difficultyGuide: Record<string, string> = {
    easy:      "concept definitions, basic use cases, single-step decisions",
    medium:    "architecture comparisons, typical exam patterns, multi-step reasoning",
    hard:      "edge cases, integration scenarios, cost/performance tradeoffs",
    nightmare: "expert-level, nuanced, scenario-based, rarely tested details",
  };

  const guide = difficultyGuide[options.difficulty] ?? difficultyGuide.medium;

  return `You are generating Knowledge Check (KC) study questions for AWS certification preparation.

Target: ${subject}
Difficulty: ${options.difficulty} (${guide})
Count: ${options.count} questions

Requirements:
- Questions must verify specific AWS knowledge, not just recall
- Each question: 4 answer options (A-D), exactly 1 correct
- Include a clear explanation for the correct answer
- Keep statements concise (max 3 sentences)
- Focus on concepts a student must UNDERSTAND, not memorize

Respond with a JSON array:
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
    "difficulty": "${options.difficulty === "nightmare" ? "hard" : options.difficulty}"
  }
]

Return ONLY the JSON array. No markdown fences.`;
}

/**
 * Generates KC questions for a given service/topic and persists them.
 * Marks all generated questions with `usage: KC`.
 */
export async function buildKcQuestions(options: KcBuildOptions): Promise<KcBuildResult> {
  const prompt = buildKcPrompt(options);

  let rawResponse: string;
  try {
    rawResponse = await callGemini(prompt);
  } catch (err) {
    logger.error({ requestId: options.requestId, err }, "kc-question-builder: Gemini call failed");
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
    logger.warn({ requestId: options.requestId }, "kc-question-builder: invalid JSON");
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
      logger.warn({ reason: validation.reason }, "kc-question-builder: rejected question");
      rejectedCount += 1;
      continue;
    }

    // persistQuestion(question, certificationId, certificationCode, usage)
    // certificationId is null — KC questions are not tied to a specific cert preset.
    const result = await persistQuestion(question, "", certCode, "KC");

    if (result.saved) savedCount += 1;
    else if (result.reason === "duplicate") duplicateCount += 1;
    else rejectedCount += 1;
  }

  logger.info(
    { requestId: options.requestId, savedCount, duplicateCount, rejectedCount },
    "kc-question-builder: done",
  );

  return { savedCount, duplicateCount, rejectedCount };
}
