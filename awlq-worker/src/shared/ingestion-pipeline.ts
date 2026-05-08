import { createHash } from "node:crypto";
import { StudyQuestionDifficulty, StudyQuestionType, StudyQuestionUsage } from "@prisma/client";
import { prisma } from "../prisma.js";

export type QuestionOption = "A" | "B" | "C" | "D" | "E";

export type ParsedQuestionOption = {
  content: string;
  isCorrect: boolean;
  explanation?: string;
};

export type ParsedQuestion = {
  statement: string;
  topic: string;
  questionType: "single" | "multi";
  options: ParsedQuestionOption[];
  awsServices: string[];
  difficulty?: "easy" | "medium" | "hard";
};

const MIN_OPTION_LENGTH = 10;
const INGESTION_VERSION = 2;

// ─── Text normalization ───────────────────────────────────────────────────────

export function normalizeText(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(/ /g, " ")
    .replace(/[​-‍﻿]/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function toSingleLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeForHash(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeList(items: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const raw of items) {
    const value = toSingleLine(raw);
    if (!value) continue;
    const key = normalizeForHash(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(value);
  }
  return output;
}

export function splitServiceCodeAndName(rawValue: string): { code: string; name: string } {
  const trimmed = toSingleLine(rawValue);
  const byDelimiter = trimmed.split(/\s*[-:|]\s*/).filter(Boolean);
  if (byDelimiter.length >= 2) {
    const maybeCode = byDelimiter[0].toUpperCase().replace(/[^A-Z0-9_]/g, "");
    const name = byDelimiter.slice(1).join(" - ").trim();
    if (maybeCode.length >= 2) return { code: maybeCode, name: name || maybeCode };
  }
  const fallbackCode =
    trimmed
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, "_")
      .slice(0, 64) || "GENERAL";
  return { code: fallbackCode, name: trimmed || fallbackCode };
}

// ─── Hash & validation ────────────────────────────────────────────────────────

export function buildUsageHash(question: Pick<ParsedQuestion, "statement" | "options">): string {
  const canonical = [
    normalizeForHash(question.statement),
    ...question.options.map(
      (o) => `${normalizeForHash(o.content)}:${o.isCorrect ? "1" : "0"}`
    ),
  ].join("|");
  return createHash("sha256").update(canonical).digest("hex");
}

export function validateQuestion(
  question: ParsedQuestion
): { valid: true } | { valid: false; reason: string } {
  if (!question.statement || question.statement.length < 12) {
    return { valid: false, reason: "statement is missing or too short" };
  }
  if (!Array.isArray(question.options) || question.options.length < 2) {
    return { valid: false, reason: "fewer than two options" };
  }
  const normalized = question.options.map((o) => normalizeForHash(o.content));
  if (new Set(normalized).size !== question.options.length) {
    return { valid: false, reason: "duplicate options" };
  }
  if (question.options.some((o) => o.content.trim().length < MIN_OPTION_LENGTH)) {
    return { valid: false, reason: "option too short (< 10 chars)" };
  }
  if (!question.options.some((o) => o.isCorrect)) {
    return { valid: false, reason: "no correct option" };
  }
  // Ensure statement references at least one AWS service
  const combined = question.statement.toLowerCase();
  const hasService = question.awsServices.some((s) => combined.includes(s.toLowerCase()));
  if (question.awsServices.length > 0 && !hasService) {
    return { valid: false, reason: "statement does not reference any listed AWS service" };
  }
  // Reject trivial negation distractors
  for (const opt of question.options) {
    if (!opt.isCorrect && /\bnot\b|\bexcept\b/i.test(opt.content)) {
      const withoutNegation = opt.content.replace(/\bnot\b|\bexcept\b/gi, "").trim();
      const correct = question.options.find((o) => o.isCorrect);
      if (correct && normalizeForHash(withoutNegation) === normalizeForHash(correct.content)) {
        return { valid: false, reason: "trivial negation distractor" };
      }
    }
  }
  return { valid: true };
}

// ─── JSON extraction ──────────────────────────────────────────────────────────

export function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

export function extractJsonArray(text: string): string | null {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

// ─── DB persistence (shared between workers) ─────────────────────────────────

export async function persistQuestion(
  question: ParsedQuestion,
  certificationId: string,
  certificationCode: string,
  usage: StudyQuestionUsage = StudyQuestionUsage.BOTH
): Promise<{ saved: true; id: string } | { saved: false; reason: "duplicate" | "db_error"; detail?: string }> {
  const usageHash = buildUsageHash(question);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.studyQuestion.findUnique({
        where: { usageHash },
        select: { id: true },
      });
      if (existing) return { duplicate: true, id: existing.id } as const;

      const opts = question.options.slice(0, 5);
      const correctLetters = opts
        .map((o, i) => (o.isCorrect ? (["A", "B", "C", "D", "E"][i] as string) : null))
        .filter((v): v is string => v !== null);

      const primaryCorrect = correctLetters[0] ?? "A";
      const questionType: StudyQuestionType =
        opts.filter((o) => o.isCorrect).length > 1 ? "multi" : "single";

      const difficulty: StudyQuestionDifficulty =
        question.difficulty === "easy"
          ? "easy"
          : question.difficulty === "hard"
            ? "hard"
            : "medium";

      const q = await tx.studyQuestion.create({
        data: {
          externalId: `WORKER-${certificationCode}-${usageHash}`,
          statement: question.statement,
          usage,
          difficulty,
          questionType,
          topic: question.topic,
          optionA: opts[0]?.content ?? "",
          optionB: opts[1]?.content ?? "",
          optionC: opts[2]?.content ?? "",
          optionD: opts[3]?.content ?? "",
          optionE: opts[4]?.content ?? null,
          correctOption: primaryCorrect,
          correctOptions: correctLetters,
          explanationA: opts[0]?.explanation ?? null,
          explanationB: opts[1]?.explanation ?? null,
          explanationC: opts[2]?.explanation ?? null,
          explanationD: opts[3]?.explanation ?? null,
          explanationE: opts[4]?.explanation ?? null,
          ingestionVersion: INGESTION_VERSION,
          usageHash,
          active: true,
          certificationPresetId: certificationId,
        },
        select: { id: true },
      });

      for (let i = 0; i < opts.length; i++) {
        const opt = opts[i]!;
        await tx.questionOption.create({
          data: {
            questionId: q.id,
            content: opt.content,
            isCorrect: opt.isCorrect,
            order: i,
            explanation: opt.explanation ?? null,
          },
        });
      }

      for (const svc of normalizeList(question.awsServices).map(splitServiceCodeAndName)) {
        const service = await tx.awsService.upsert({
          where: { code: svc.code },
          update: { name: svc.name, active: true },
          create: { code: svc.code, name: svc.name, active: true },
          select: { id: true },
        });
        await tx.questionAwsService.upsert({
          where: { questionId_serviceId: { questionId: q.id, serviceId: service.id } },
          update: {},
          create: { questionId: q.id, serviceId: service.id },
        });
      }

      return { duplicate: false, id: q.id } as const;
    });

    if (result.duplicate) return { saved: false, reason: "duplicate" };
    return { saved: true, id: result.id };
  } catch (err) {
    return {
      saved: false,
      reason: "db_error",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─── Answer snapshot helpers ──────────────────────────────────────────────────

function isOptionKey(v: unknown): v is QuestionOption {
  return v === "A" || v === "B" || v === "C" || v === "D" || v === "E";
}

function normalizeOptionArray(v: unknown): QuestionOption[] {
  if (!Array.isArray(v)) return [];
  const s = new Set<QuestionOption>();
  for (const item of v) if (isOptionKey(item)) s.add(item);
  return Array.from(s).sort();
}

export type AnswerSnapshot = {
  questionId: string;
  questionType?: unknown;
  selectedOption?: unknown;
  selectedOptions?: unknown;
  correctOption?: unknown;
  correctOptions?: unknown;
};

export function isCorrectAnswer(a: AnswerSnapshot): boolean {
  const expected = normalizeOptionArray(a.correctOptions);
  const fallback = isOptionKey(a.correctOption) ? a.correctOption : "A";
  const normalizedExpected = expected.length > 0 ? expected : [fallback];

  const selectedArr = normalizeOptionArray(a.selectedOptions);
  const selected =
    selectedArr.length > 0 ? selectedArr : isOptionKey(a.selectedOption) ? [a.selectedOption] : [];

  if (a.questionType !== "multi") {
    return selected.length === 1 && selected[0] === normalizedExpected[0];
  }
  if (selected.length !== normalizedExpected.length) return false;
  return normalizedExpected.every((opt, i) => opt === selected[i]);
}
