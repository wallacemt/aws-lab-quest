import { createHash } from "node:crypto";
import { StudyQuestionDifficulty, StudyQuestionUsage } from "@prisma/client";
import { getAiModel, extractJsonObject } from "@/lib/ai";
import { devAuditLog } from "@/lib/dev-audit";
import { prisma } from "@/lib/prisma";

const MIN_OPTION_LENGTH = 3;
const INGESTION_VERSION = 2;
const OPTION_REGEX = /^\s*(?:[A-Ea-e]|[1-5])\s*[\)\.\-:]\s+(.+)$/;

type PdfParseResult = {
  text?: string;
};

async function parsePdfBuffer(buffer: Buffer): Promise<string> {
  const pdfModule = await import("pdf-parse/lib/pdf-parse.js");
  const parser = (pdfModule.default ?? pdfModule) as (dataBuffer: Buffer) => Promise<PdfParseResult>;
  const parsed = await parser(buffer);
  return parsed.text ?? "";
}

export type ParsedQuestionOption = {
  content: string;
  isCorrect: boolean;
};

export type ParsedQuestion = {
  statement: string;
  options: ParsedQuestionOption[];
  explanation: string | null;
  awsServices: string[];
  topics: string[];
};

export type DetectedQuestionBlock = {
  blockId: number;
  rawText: string;
  sourceFileName: string;
};

export type IngestedQuestionPreview = ParsedQuestion & {
  id: string;
  usageHash: string;
  rawText: string;
};

export type IngestionRejectReason =
  | "empty_text"
  | "unsupported_file"
  | "invalid_block"
  | "llm_parse_failed"
  | "invalid_question"
  | "duplicate_hash"
  | "db_error";

export type IngestionReject = {
  fileName: string;
  blockId?: number;
  reason: IngestionRejectReason;
  detail: string;
};

export type IngestQuestionsResult = {
  certificationCode: string;
  generatedCount: number;
  savedCount: number;
  rejectedCount: number;
  duplicateCount: number;
  extractedQuestions: IngestedQuestionPreview[];
  rejects: IngestionReject[];
};

type IngestOptions = {
  certificationCode: string;
  sourceUploadedFileIdsByName?: Record<string, string>;
  onProgress?: (progress: {
    status: "EXTRACTING" | "GENERATING" | "SAVING" | "COMPLETED";
    progressPercent: number;
    message: string;
    generatedCount?: number;
    savedCount?: number;
    rejectedCount?: number;
  }) => Promise<void> | void;
};

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
    if (!value) {
      continue;
    }

    const key = normalizeForHash(value);
    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push(value);
  }

  return output;
}

function normalizeOptionText(value: string): string {
  return toSingleLine(value)
    .replace(/^\(?[A-Ea-e1-5]\)?\s*[\)\.\-:]\s+/, "")
    .trim();
}

function normalizeQuestionType(options: ParsedQuestionOption[]): "single" | "multi" {
  const correctCount = options.filter((item) => item.isCorrect).length;
  return correctCount > 1 ? "multi" : "single";
}

function splitServiceCodeAndName(rawValue: string): { code: string; name: string } {
  const trimmed = toSingleLine(rawValue);
  const byDelimiter = trimmed.split(/\s*[-:|]\s*/).filter(Boolean);

  if (byDelimiter.length >= 2) {
    const maybeCode = byDelimiter[0].toUpperCase().replace(/[^A-Z0-9_]/g, "");
    const name = byDelimiter.slice(1).join(" - ").trim();
    if (maybeCode.length >= 2) {
      return {
        code: maybeCode,
        name: name || maybeCode,
      };
    }
  }

  const fallbackCode =
    trimmed
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, "_")
      .slice(0, 64) || "GENERAL";
  return {
    code: fallbackCode,
    name: trimmed || fallbackCode,
  };
}

function buildUsageHash(question: ParsedQuestion): string {
  const canonical = [
    normalizeForHash(question.statement),
    ...question.options.map((item) => `${normalizeForHash(item.content)}:${item.isCorrect ? "1" : "0"}`),
    normalizeForHash(question.explanation ?? ""),
  ].join("|");

  return createHash("sha256").update(canonical).digest("hex");
}

function looksLikeQuestionStart(line: string): boolean {
  const normalized = line.trim();
  if (!normalized) {
    return false;
  }

  return (
    /^(?:question|pergunta|quest[aã]o|item|q)\s*\d+\s*[\)\.\-:]/i.test(normalized) ||
    /^\d{1,3}\s*[\)\.\-:]\s+/.test(normalized)
  );
}

function hasMinimumOptionLines(text: string): boolean {
  const lines = text.split("\n");
  const optionLines = lines.filter((line) => OPTION_REGEX.test(line));
  return optionLines.length >= 2;
}

export async function extractTextFromFile(file: File): Promise<string> {
  const fileName = file.name.toLowerCase();
  const mimeType = file.type.toLowerCase();

  if (fileName.endsWith(".md") || mimeType === "text/markdown" || mimeType === "text/plain") {
    return file.text();
  }

  if (fileName.endsWith(".pdf") || mimeType === "application/pdf") {
    const buffer = Buffer.from(await file.arrayBuffer());
    return parsePdfBuffer(buffer);
  }

  throw new Error(`Unsupported file type: ${file.name}`);
}

export function normalizeText(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(/\u00A0/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function detectQuestionBlocks(normalizedText: string, sourceFileName = "unknown"): DetectedQuestionBlock[] {
  if (!normalizedText) {
    return [];
  }

  const lines = normalizedText.split("\n");
  const starts: number[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    if (looksLikeQuestionStart(lines[index])) {
      starts.push(index);
    }
  }

  const blocks: DetectedQuestionBlock[] = [];

  if (starts.length > 0) {
    for (let index = 0; index < starts.length; index += 1) {
      const start = starts[index];
      const end = index + 1 < starts.length ? starts[index + 1] : lines.length;
      const rawText = lines.slice(start, end).join("\n").trim();

      if (!rawText || rawText.length < 40 || !hasMinimumOptionLines(rawText)) {
        continue;
      }

      blocks.push({
        blockId: blocks.length + 1,
        rawText,
        sourceFileName,
      });
    }

    return blocks;
  }

  const fallbackParts = normalizedText.split(/\n\s*\n/g).map((part) => part.trim());

  for (const part of fallbackParts) {
    if (!part || part.length < 40 || !hasMinimumOptionLines(part)) {
      continue;
    }

    blocks.push({
      blockId: blocks.length + 1,
      rawText: part,
      sourceFileName,
    });
  }

  return blocks;
}

function parseLlmJson(text: string): ParsedQuestion | null {
  const rawObject = extractJsonObject(text) ?? text.trim();
  if (!rawObject) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawObject);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const typed = parsed as {
    statement?: unknown;
    options?: unknown;
    explanation?: unknown;
    awsServices?: unknown;
    topics?: unknown;
  };

  const options = Array.isArray(typed.options)
    ? typed.options
        .map((option) => {
          if (!option || typeof option !== "object") {
            return null;
          }

          const item = option as { content?: unknown; isCorrect?: unknown };
          const content = normalizeOptionText(String(item.content ?? ""));
          const isCorrect = Boolean(item.isCorrect);

          if (!content) {
            return null;
          }

          return { content, isCorrect } as ParsedQuestionOption;
        })
        .filter((item): item is ParsedQuestionOption => item !== null)
    : [];

  const awsServices = Array.isArray(typed.awsServices)
    ? normalizeList(typed.awsServices.map((item) => String(item)))
    : [];
  const topics = Array.isArray(typed.topics) ? normalizeList(typed.topics.map((item) => String(item))) : [];
  const statement = toSingleLine(String(typed.statement ?? ""));
  const explanationRaw = typed.explanation;
  const explanation =
    explanationRaw == null || String(explanationRaw).trim().toLowerCase() === "null"
      ? null
      : toSingleLine(String(explanationRaw));

  return {
    statement,
    options,
    explanation,
    awsServices,
    topics,
  };
}

export async function parseQuestionWithLLM(block: DetectedQuestionBlock): Promise<ParsedQuestion | null> {
  const model = getAiModel();

  const prompt = [
    "You receive exactly one question block extracted from a study document.",
    "Extract it as strict JSON. Do not invent data.",
    "If data is missing, return null fields and keep options only when explicit.",
    "Return exactly one JSON object, no markdown.",
    "JSON schema:",
    "{",
    '  "statement": "string",',
    '  "options": [',
    '    { "content": "string", "isCorrect": true }',
    "  ],",
    '  "explanation": "string | null",',
    '  "awsServices": ["string"],',
    '  "topics": ["string"]',
    "}",
    "Rules:",
    "- Preserve original language.",
    "- options must include all listed alternatives from the block.",
    "- isCorrect can be true only if the block explicitly provides an answer key.",
    "Question block:",
    block.rawText,
  ].join("\n");

  const response = await model.generateContent(prompt);
  return parseLlmJson(response.response.text());
}

export function validateQuestion(question: ParsedQuestion): { valid: true } | { valid: false; reason: string } {
  if (!question.statement || question.statement.length < 12) {
    return { valid: false, reason: "statement is missing" };
  }

  if (!Array.isArray(question.options) || question.options.length < 2) {
    return { valid: false, reason: "question has fewer than two options" };
  }

  const normalizedOptions = question.options.map((option) => normalizeForHash(option.content));
  const optionSet = new Set(normalizedOptions);

  if (optionSet.size !== question.options.length) {
    return { valid: false, reason: "duplicated options" };
  }

  if (question.options.some((option) => option.content.trim().length < MIN_OPTION_LENGTH)) {
    return { valid: false, reason: "options too short" };
  }

  const correctCount = question.options.filter((option) => option.isCorrect).length;
  if (correctCount < 1) {
    return { valid: false, reason: "no correct option" };
  }

  return { valid: true };
}

export async function ingestQuestions(files: File[], options?: IngestOptions): Promise<IngestQuestionsResult> {
  if (!options?.certificationCode) {
    throw new Error("certificationCode is required for ingestion.");
  }

  const certification = await prisma.certificationPreset.findUnique({
    where: { code: options.certificationCode },
    select: { id: true, code: true },
  });

  if (!certification) {
    throw new Error("Invalid certificationCode.");
  }

  const rejects: IngestionReject[] = [];
  const extractedQuestions: IngestedQuestionPreview[] = [];

  let generatedCount = 0;
  let savedCount = 0;
  let duplicateCount = 0;

  for (let fileIndex = 0; fileIndex < files.length; fileIndex += 1) {
    const file = files[fileIndex];
    const fileName = file.name;

    await options.onProgress?.({
      status: "EXTRACTING",
      progressPercent: Math.min(35, 10 + Math.round((fileIndex / Math.max(files.length, 1)) * 25)),
      message: `Extracting text from ${fileName}`,
    });

    let rawText = "";
    try {
      rawText = await extractTextFromFile(file);
    } catch (error) {
      rejects.push({
        fileName,
        reason: "unsupported_file",
        detail: error instanceof Error ? error.message : "Unsupported file type.",
      });
      continue;
    }

    const normalized = normalizeText(rawText);
    if (!normalized) {
      rejects.push({
        fileName,
        reason: "empty_text",
        detail: "No readable text extracted.",
      });
      continue;
    }

    const blocks = detectQuestionBlocks(normalized, fileName);
    if (blocks.length === 0) {
      rejects.push({
        fileName,
        reason: "invalid_block",
        detail: "No complete question blocks were detected.",
      });
      continue;
    }

    for (let blockIndex = 0; blockIndex < blocks.length; blockIndex += 1) {
      const block = blocks[blockIndex];

      await options.onProgress?.({
        status: "GENERATING",
        progressPercent: Math.min(80, 35 + Math.round(((blockIndex + 1) / Math.max(blocks.length, 1)) * 45)),
        message: `Parsing block ${block.blockId} from ${fileName}`,
      });

      const parsed = await parseQuestionWithLLM(block).catch(() => null);
      if (!parsed) {
        rejects.push({
          fileName,
          blockId: block.blockId,
          reason: "llm_parse_failed",
          detail: "LLM output could not be parsed as strict JSON.",
        });
        continue;
      }

      generatedCount += 1;

      const validation = validateQuestion(parsed);
      if (!validation.valid) {
        rejects.push({
          fileName,
          blockId: block.blockId,
          reason: "invalid_question",
          detail: validation.reason,
        });
        continue;
      }

      const usageHash = buildUsageHash(parsed);
      const sourceUploadedFileId = options.sourceUploadedFileIdsByName?.[fileName] ?? null;

      try {
        const created = await prisma.$transaction(async (tx) => {
          const existing = await tx.studyQuestion.findUnique({
            where: { usageHash },
            select: { id: true },
          });

          if (existing) {
            return { duplicate: true, id: existing.id } as const;
          }

          const normalizedOptions = parsed.options.slice(0, 5);
          const optionByOrder = normalizedOptions.map((item) => item.content);
          const correctIndexes = normalizedOptions
            .map((item, index) => ({ index, isCorrect: item.isCorrect }))
            .filter((item) => item.isCorrect)
            .map((item) => item.index);

          const correctLetters = correctIndexes
            .map((idx) => ["A", "B", "C", "D", "E"][idx])
            .filter((value): value is "A" | "B" | "C" | "D" | "E" => Boolean(value));

          const primaryCorrect = correctLetters[0] ?? "A";
          const questionType = normalizeQuestionType(normalizedOptions);
          const difficulty: StudyQuestionDifficulty = "medium";
          const fallbackTopic = parsed.topics[0] ?? parsed.awsServices[0] ?? "GENERAL";

          const question = await tx.studyQuestion.create({
            data: {
              externalId: `INGEST-${certification.code}-${usageHash}`,
              statement: parsed.statement,
              usage: StudyQuestionUsage.BOTH,
              difficulty,
              questionType,
              topic: fallbackTopic,
              optionA: optionByOrder[0] ?? "",
              optionB: optionByOrder[1] ?? "",
              optionC: optionByOrder[2] ?? "",
              optionD: optionByOrder[3] ?? "",
              optionE: optionByOrder[4] ?? null,
              correctOption: primaryCorrect,
              correctOptions: correctLetters,
              explanationA: parsed.explanation,
              explanationB: parsed.explanation,
              explanationC: parsed.explanation,
              explanationD: parsed.explanation,
              explanationE: parsed.explanation,
              rawText: block.rawText,
              ingestionVersion: INGESTION_VERSION,
              usageHash,
              active: true,
              certificationPresetId: certification.id,
              sourceUploadedFileId,
            },
            select: { id: true },
          });

          for (let idx = 0; idx < normalizedOptions.length; idx += 1) {
            const option = normalizedOptions[idx];
            await tx.questionOption.create({
              data: {
                questionId: question.id,
                content: option.content,
                isCorrect: option.isCorrect,
                order: idx,
                explanation: option.isCorrect ? parsed.explanation : null,
              },
            });
          }

          const serviceCodes = normalizeList(parsed.awsServices).map(splitServiceCodeAndName);
          for (const serviceInput of serviceCodes) {
            const service = await tx.awsService.upsert({
              where: { code: serviceInput.code },
              update: { name: serviceInput.name, active: true },
              create: {
                code: serviceInput.code,
                name: serviceInput.name,
                active: true,
              },
              select: { id: true },
            });

            await tx.questionAwsService.create({
              data: {
                questionId: question.id,
                serviceId: service.id,
              },
            });
          }

          const topics = normalizeList(parsed.topics);
          for (const topicName of topics) {
            const topic = await tx.topic.upsert({
              where: { name: topicName },
              update: {},
              create: { name: topicName },
              select: { id: true },
            });

            await tx.questionTopic.create({
              data: {
                questionId: question.id,
                topicId: topic.id,
              },
            });
          }

          return { duplicate: false, id: question.id } as const;
        });

        if (created.duplicate) {
          duplicateCount += 1;
          rejects.push({
            fileName,
            blockId: block.blockId,
            reason: "duplicate_hash",
            detail: "Duplicate question skipped by usageHash.",
          });
          continue;
        }

        savedCount += 1;
        extractedQuestions.push({
          id: created.id,
          usageHash,
          rawText: block.rawText,
          ...parsed,
        });
      } catch (error) {
        rejects.push({
          fileName,
          blockId: block.blockId,
          reason: "db_error",
          detail: error instanceof Error ? error.message : "Unexpected database error.",
        });
      }
    }
  }

  await options.onProgress?.({
    status: "COMPLETED",
    progressPercent: 100,
    message: "Question ingestion completed.",
    generatedCount,
    savedCount,
    rejectedCount: rejects.length,
  });

  devAuditLog("study.ingestion.pipeline.summary", {
    certificationCode: options.certificationCode,
    files: files.length,
    generatedCount,
    savedCount,
    duplicateCount,
    rejectedCount: rejects.length,
  });

  return {
    certificationCode: options.certificationCode,
    generatedCount,
    savedCount,
    rejectedCount: rejects.length,
    duplicateCount,
    extractedQuestions,
    rejects,
  };
}
