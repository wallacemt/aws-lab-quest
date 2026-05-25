import { callGemini } from "../ai.js";
import { logger } from "../shared/logger.js";
import type { ParsedQuestion } from "../shared/ingestion-pipeline.js";
import type { DomainTarget } from "./question-builder.js";

type ReviewAction = "accept" | "improve" | "reject";

export type QuestionReviewResult = {
  action: ReviewAction;
  improved?: ParsedQuestion;
  reason: string;
};

type BatchReviewItem = {
  index: number;
  action: ReviewAction;
  improved?: ParsedQuestion;
  reason: string;
};

function formatOptions(question: ParsedQuestion): string {
  return question.options
    .map((o, i) => {
      const label = ["A", "B", "C", "D", "E"][i] ?? String(i + 1);
      return `${label}) ${o.content}${o.isCorrect ? " [CORRECT]" : ""}`;
    })
    .join("\n");
}

function buildBatchPrompt(
  questions: ParsedQuestion[],
  domain: DomainTarget,
  certCode: string,
  certName: string,
): string {
  const questionsBlock = questions
    .map(
      (q, i) => `--- Question ${i} ---
Statement: ${q.statement}
${formatOptions(q)}
Topic: ${q.topic}
Difficulty: ${q.difficulty ?? "medium"}`,
    )
    .join("\n\n");

  const topicsLine =
    domain.subTopics.length > 0 ? domain.subTopics.join(", ") : "general domain content";

  return `You are a quality gate for AWS ${certCode} (${certName}) certification exam questions.

EXAM DOMAIN: "${domain.domainName}" (${domain.weightPercent}% of exam)
REQUIRED TOPICS: ${topicsLine}

For each question evaluate:
1. DOMAIN ALIGNMENT: Does it test a concept from the required topics above?
2. SCENARIO QUALITY: Is there a real business scenario with a specific AWS architectural decision?
3. DISTRACTOR QUALITY: Are wrong options plausible but clearly distinguishable from the correct answer?

Decide for each question:
- "accept": question is good as-is
- "improve": fixable issues (rewrite it, include full improved question in "improved")
- "reject": fundamentally flawed or completely off-domain

${questionsBlock}

Return ONLY a valid JSON array, one entry per question in the same order:
[
  {
    "index": 0,
    "action": "accept",
    "reason": "brief explanation"
  },
  {
    "index": 1,
    "action": "improve",
    "reason": "brief explanation",
    "improved": {
      "statement": "string",
      "topic": "string",
      "questionType": "single",
      "difficulty": "medium",
      "awsServices": ["ServiceName"],
      "options": [
        { "content": "string", "isCorrect": true, "explanation": "string" },
        { "content": "string", "isCorrect": false, "explanation": "string" },
        { "content": "string", "isCorrect": false, "explanation": "string" },
        { "content": "string", "isCorrect": false, "explanation": "string" }
      ]
    }
  }
]`;
}

function parseImprovedQuestion(raw: unknown): ParsedQuestion | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const t = raw as Record<string, unknown>;
  const statement = typeof t.statement === "string" ? t.statement.trim() : "";
  const topic = typeof t.topic === "string" ? t.topic.trim() : "General";
  const questionType = t.questionType === "multi" ? ("multi" as const) : ("single" as const);
  const difficulty =
    t.difficulty === "easy" ? "easy" : t.difficulty === "hard" ? "hard" : ("medium" as const);
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
            typeof opt.explanation === "string" ? opt.explanation.trim() : undefined;
          if (!content) return null;
          return { content, isCorrect: Boolean(opt.isCorrect), explanation };
        })
        .filter((o): o is NonNullable<typeof o> => o !== null)
    : [];
  if (!statement || options.length < 2) return undefined;
  return { statement, topic, questionType, difficulty, awsServices, options };
}

export async function reviewGeneratedQuestions(
  questions: ParsedQuestion[],
  domain: DomainTarget,
  certCode: string,
  certName: string,
): Promise<QuestionReviewResult[]> {
  if (questions.length === 0) return [];

  const prompt = buildBatchPrompt(questions, domain, certCode, certName);

  let response: string;
  try {
    response = await callGemini(prompt);
  } catch (err) {
    logger.warn({ err }, "exam-guide-reviewer: Gemini call failed, accepting all");
    return questions.map(() => ({ action: "accept" as const, reason: "reviewer unavailable" }));
  }

  const jsonStart = response.indexOf("[");
  const jsonEnd = response.lastIndexOf("]");
  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
    logger.warn("exam-guide-reviewer: could not parse JSON array, accepting all");
    return questions.map(() => ({ action: "accept" as const, reason: "parse error" }));
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(response.slice(jsonStart, jsonEnd + 1));
  } catch {
    logger.warn("exam-guide-reviewer: JSON parse error, accepting all");
    return questions.map(() => ({ action: "accept" as const, reason: "parse error" }));
  }

  if (!Array.isArray(parsed)) {
    return questions.map(() => ({ action: "accept" as const, reason: "invalid response format" }));
  }

  const itemsByIndex = new Map<number, BatchReviewItem>();
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const t = item as Record<string, unknown>;
    const index = typeof t.index === "number" ? t.index : -1;
    const action =
      t.action === "reject" ? "reject" : t.action === "improve" ? "improve" : "accept";
    const reason = typeof t.reason === "string" ? t.reason : "";
    const improved = action === "improve" ? parseImprovedQuestion(t.improved) : undefined;
    if (index >= 0 && index < questions.length) {
      itemsByIndex.set(index, { index, action, improved, reason });
    }
  }

  return questions.map((_, i) => {
    const item = itemsByIndex.get(i);
    if (!item) return { action: "accept" as const, reason: "not reviewed" };
    return { action: item.action, improved: item.improved, reason: item.reason };
  });
}
