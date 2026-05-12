import { callGemini } from "../ai.js";
import {
  ParsedQuestion,
  buildUsageHash,
  extractJsonObject,
  persistQuestion,
  validateQuestion,
} from "../shared/ingestion-pipeline.js";
import { logger } from "../shared/logger.js";
import { StudyQuestionUsage } from "@prisma/client";

export type DomainTarget = {
  domainName: string;
  weightPercent: number;
  subTopics: string[];
};

export type WeakAreaFilter = {
  serviceCode?: string;
  topicName?: string;
  targetCorrectRate: number;
};

export type GenerationOptions = {
  certificationPresetId: string;
  certificationCode: string;
  certificationName: string;
  domains: DomainTarget[];
  totalTarget: number;
  difficulty?: "easy" | "medium" | "hard" | "mixed";
  triggerType: "scheduled" | "weak_area" | "manual";
  weakAreaFilter?: WeakAreaFilter;
};

export type GenerationResult = {
  savedCount: number;
  duplicateCount: number;
  rejectedCount: number;
};

function distributeByDomain(
  domains: DomainTarget[],
  totalTarget: number
): Array<DomainTarget & { count: number }> {
  const total = domains.reduce((s, d) => s + d.weightPercent, 0) || 100;
  return domains.map((d) => ({
    ...d,
    count: Math.max(1, Math.round((d.weightPercent / total) * totalTarget)),
  }));
}

function buildPrompt(
  certCode: string,
  certName: string,
  domain: DomainTarget,
  count: number,
  difficulty: string,
  weakAreaFilter?: WeakAreaFilter
): string {
  const weakContext = weakAreaFilter
    ? `CONTEXTO: Os alunos respondem corretamente apenas ${Math.round(weakAreaFilter.targetCorrectRate * 100)}% das questões sobre ` +
      `${weakAreaFilter.serviceCode ?? weakAreaFilter.topicName ?? "este tópico"}. ` +
      `Gere questões que desenvolvam progressivamente o entendimento — comece pelos conceitos fundamentais e aumente até cenários de nível de prova. ` +
      `Inclua explicações claras e educativas.\n\n`
    : "";

  const difficultyInstruction =
    difficulty === "mixed"
      ? "Mix all difficulty levels (approximately 30% easy, 40% medium, 30% hard)."
      : `All questions should be ${difficulty} difficulty.`;

  const multiInstruction =
    difficulty === "hard" || difficulty === "mixed"
      ? "About 30% of questions should be multi-select (select TWO answers)."
      : "All questions should be single-select (one correct answer).";

  return `${weakContext}You are an AWS certification exam question author for ${certCode} (${certName}).

EXAM DOMAIN: ${domain.domainName} (${domain.weightPercent}% of exam)
TOPICS COVERED: ${domain.subTopics.length > 0 ? domain.subTopics.join(", ") : "general domain content"}
DIFFICULTY: ${difficultyInstruction}
${multiInstruction}

Rules for every question:
1. SCENARIO-BASED: Each question presents a real company or team with a specific AWS problem.
2. SERVICE COMPARISON: Incorrect options must be plausible AWS services that could be confused with the correct answer.
3. ARCHITECTURAL DECISION: Use phrasing like "MOST cost-effective", "BEST meets the requirement", "MOST operationally efficient".
4. OPTIONS: Exactly 4 options (A–D) for single-select, 5 options (A–E) for multi-select.
5. EXPLANATIONS: Each option must have an explanation of ≥ 40 characters explaining why it is correct or incorrect.
6. IDIOMA: Apenas português brasileiro. Escreva enunciados, alternativas e explicações em pt-BR.

Generate exactly ${count} questions.

Return ONLY valid JSON with this exact structure:
{
  "questions": [
    {
      "statement": "string (40–250 words scenario + question)",
      "topic": "string (primary sub-topic from the domain)",
      "questionType": "single",
      "difficulty": "medium",
      "awsServices": ["EC2", "S3"],
      "options": [
        { "content": "string", "isCorrect": true, "explanation": "string (≥ 40 chars)" },
        { "content": "string", "isCorrect": false, "explanation": "string (≥ 40 chars)" },
        { "content": "string", "isCorrect": false, "explanation": "string (≥ 40 chars)" },
        { "content": "string", "isCorrect": false, "explanation": "string (≥ 40 chars)" }
      ]
    }
  ]
}`;
}

function parseQuestionsFromLlm(text: string): ParsedQuestion[] {
  const jsonStr = extractJsonObject(text);
  if (!jsonStr) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return [];
  }

  if (!parsed || typeof parsed !== "object") return [];
  const root = parsed as Record<string, unknown>;
  if (!Array.isArray(root.questions)) return [];

  return root.questions
    .map((q: unknown): ParsedQuestion | null => {
      if (!q || typeof q !== "object") return null;
      const t = q as Record<string, unknown>;

      const statement = typeof t.statement === "string" ? t.statement.trim() : "";
      const topic = typeof t.topic === "string" ? t.topic.trim() : "General";
      const questionType =
        t.questionType === "multi" ? ("multi" as const) : ("single" as const);
      const difficulty =
        t.difficulty === "easy" ? "easy" : t.difficulty === "hard" ? "hard" : "medium";
      const awsServices = Array.isArray(t.awsServices)
        ? (t.awsServices as unknown[]).map(String)
        : [];

      const options = Array.isArray(t.options)
        ? (t.options as unknown[])
            .map((o: unknown) => {
              if (!o || typeof o !== "object") return null;
              const opt = o as Record<string, unknown>;
              const content = typeof opt.content === "string" ? opt.content.trim() : "";
              const explanation =
                typeof opt.explanation === "string" ? opt.explanation.trim() : "";
              if (!content) return null;
              return {
                content,
                isCorrect: Boolean(opt.isCorrect),
                explanation: explanation || undefined,
              };
            })
            .filter((o): o is NonNullable<typeof o> => o !== null)
        : [];

      return { statement, topic, questionType, difficulty, awsServices, options };
    })
    .filter((q): q is ParsedQuestion => q !== null);
}

export async function generateAndPersistQuestions(
  options: GenerationOptions
): Promise<GenerationResult> {
  const result: GenerationResult = { savedCount: 0, duplicateCount: 0, rejectedCount: 0 };

  const distributed = distributeByDomain(options.domains, options.totalTarget);
  const difficulty = options.difficulty ?? "mixed";
  const usage: StudyQuestionUsage =
    options.triggerType === "weak_area" ? StudyQuestionUsage.BOTH : StudyQuestionUsage.BOTH;

  for (const domainTarget of distributed) {
    if (domainTarget.count === 0) continue;

    const prompt = buildPrompt(
      options.certificationCode,
      options.certificationName,
      domainTarget,
      domainTarget.count,
      difficulty,
      options.weakAreaFilter
    );

    let llmResponse: string;
    try {
      llmResponse = await callGemini(prompt);
    } catch (err) {
      logger.error({ err, domain: domainTarget.domainName }, "Gemini call failed");
      result.rejectedCount += domainTarget.count;
      continue;
    }

    const questions = parseQuestionsFromLlm(llmResponse);
    if (questions.length === 0) {
      logger.warn({ domain: domainTarget.domainName }, "No questions parsed from LLM response");
      result.rejectedCount += domainTarget.count;
      continue;
    }

    for (const question of questions) {
      const validation = validateQuestion(question);
      if (!validation.valid) {
        logger.debug({ reason: validation.reason }, "Question rejected by validator");
        result.rejectedCount++;
        continue;
      }

      const persisted = await persistQuestion(
        question,
        options.certificationPresetId,
        options.certificationCode,
        usage
      );

      if (persisted.saved) {
        result.savedCount++;
      } else if (persisted.reason === "duplicate") {
        result.duplicateCount++;
      } else {
        logger.error({ detail: persisted.detail }, "DB error persisting question");
        result.rejectedCount++;
      }
    }
  }

  return result;
}

export function computeTargetCount(correctRate: number): number {
  const deficit = Math.max(0, 0.6 - correctRate);
  return Math.min(30, Math.max(5, Math.round(deficit * 50)));
}
