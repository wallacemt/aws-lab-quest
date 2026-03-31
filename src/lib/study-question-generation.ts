import { StudyQuestionDifficulty, StudyQuestionUsage } from "@prisma/client";
import { getAiModel } from "@/lib/ai";
import { devAuditLog } from "@/lib/dev-audit";
import { prisma } from "@/lib/prisma";

const MAX_GUIDE_CONTEXT_CHARS = 4_500;
const MAX_SOURCE_CONTEXT_CHARS = 7_500;
const MAX_EXTRACT_CHUNK_CHARS = 14_000;
const EXTRACT_QUESTIONS_PER_CHUNK = 8;
const TOKEN_ESTIMATE_CHARS_PER_TOKEN = 4;
const SAFE_TOKENS_PER_MINUTE = Number(process.env.GEMINI_SAFE_TOKENS_PER_MINUTE ?? 9_000);
const MIN_CALL_INTERVAL_MS = Number(process.env.GEMINI_MIN_CALL_INTERVAL_MS ?? 2_500);
const MAX_AI_RETRIES = 5;

let lastAiCallAt = 0;

type ServiceContext = {
  code: string;
  name: string;
};

type CertificationContext = {
  id: string;
  code: string;
  name: string;
  examGuide?: string | null;
};

type GeneratedQuestion = {
  statement: string;
  serviceCode: string;
  difficulty: "easy" | "medium" | "hard";
  questionType?: "single" | "multi";
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  optionE?: string;
  correctOption: "A" | "B" | "C" | "D" | "E";
  correctOptions?: Array<"A" | "B" | "C" | "D" | "E">;
  explanationA: string;
  explanationB: string;
  explanationC: string;
  explanationD: string;
  explanationE?: string;
};

type EnsurePoolInput = {
  certification: CertificationContext;
  usage: StudyQuestionUsage;
  difficulty: StudyQuestionDifficulty;
  desiredCount: number;
  selectedServiceCodes?: string[];
};

type IngestMode = "generate-new" | "extract-existing";

type TaggedQuestionBlock = {
  qid: number;
  content: string;
};

type QuestionRejectionReason =
  | "invalid_service_code"
  | "invalid_statement"
  | "statement_truncated"
  | "missing_required_options"
  | "invalid_correct_answer"
  | "empty_explanations"
  | "duplicate_question";

type SanitizationResult = {
  question: GeneratedQuestion;
  dedupeKey: string;
};

type SanitizationFailure = {
  reason: QuestionRejectionReason;
  detail: string;
};

type IngestionSanitizationSummary = {
  rejectedCount: number;
  rejectionReasons: Record<QuestionRejectionReason, number>;
};

function sleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => setTimeout(resolve, ms));
}

function estimateTokensFromText(value: string): number {
  if (!value) {
    return 0;
  }

  return Math.ceil(value.length / TOKEN_ESTIMATE_CHARS_PER_TOKEN);
}

function parseRetryDelayMs(error: unknown): number | null {
  const message = error instanceof Error ? error.message : String(error);
  if (!message) {
    return null;
  }

  const retryInMatch = message.match(/retry in\s+([\d.]+)s/i);
  if (retryInMatch) {
    const seconds = Number(retryInMatch[1]);
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.round(seconds * 1000);
    }
  }

  const retryDelayMatch = message.match(/"retryDelay"\s*:\s*"(\d+)s"/i);
  if (retryDelayMatch) {
    const seconds = Number(retryDelayMatch[1]);
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.round(seconds * 1000);
    }
  }

  return null;
}

async function paceAiCall(prompt: string): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastAiCallAt;

  const estimatedTokens = estimateTokensFromText(prompt);
  const quotaDelayMs = Math.ceil((estimatedTokens / Math.max(1, SAFE_TOKENS_PER_MINUTE)) * 60_000);
  const requiredDelayMs = Math.max(MIN_CALL_INTERVAL_MS, quotaDelayMs);

  if (elapsed < requiredDelayMs) {
    await sleep(requiredDelayMs - elapsed);
  }

  lastAiCallAt = Date.now();
}

async function generateContentWithQuotaProtection(prompt: string): Promise<string> {
  const model = getAiModel();

  for (let attempt = 1; attempt <= MAX_AI_RETRIES; attempt += 1) {
    try {
      await paceAiCall(prompt);
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isQuotaError = /429|quota|rate limit|too many requests/i.test(message);

      if (!isQuotaError || attempt === MAX_AI_RETRIES) {
        throw error;
      }

      const retryDelayMs = parseRetryDelayMs(error);
      const backoffMs = Math.min(60_000, 3_000 * 2 ** (attempt - 1));
      const jitterMs = Math.floor(Math.random() * 1_000);
      await sleep(Math.max(backoffMs, retryDelayMs ?? 0) + jitterMs);
    }
  }

  throw new Error("Falha ao gerar conteudo com IA apos multiplas tentativas.");
}

function normalizeDifficulty(value: string): StudyQuestionDifficulty {
  if (value === "easy" || value === "medium" || value === "hard") {
    return value;
  }
  return "easy";
}

function normalizeCorrectOption(value: string): "A" | "B" | "C" | "D" | "E" {
  if (value === "A" || value === "B" || value === "C" || value === "D" || value === "E") {
    return value;
  }
  return "A";
}

function normalizeQuestionType(value: string | undefined): "single" | "multi" {
  return value === "multi" ? "multi" : "single";
}

function normalizeCorrectOptions(
  value: unknown,
  fallback: "A" | "B" | "C" | "D" | "E",
  questionType: "single" | "multi",
): Array<"A" | "B" | "C" | "D" | "E"> {
  const deduped = new Set<"A" | "B" | "C" | "D" | "E">();
  if (Array.isArray(value)) {
    for (const item of value) {
      if (item === "A" || item === "B" || item === "C" || item === "D" || item === "E") {
        deduped.add(item);
      }
    }
  }

  const options = Array.from(deduped);
  if (questionType === "multi" && options.length >= 2) {
    return options;
  }

  if (options.length > 0) {
    return [options[0]];
  }

  return [fallback];
}

function tryParseJsonArray(raw: string): unknown[] {
  const direct = raw.trim();
  try {
    const parsed = JSON.parse(direct);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // ignore and try extraction below
  }

  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) {
    return [];
  }

  const sliced = raw.slice(start, end + 1);
  try {
    const parsed = JSON.parse(sliced);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    return [];
  }

  return [];
}

function normalizeStatementKey(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function buildQuestionDedupeKey(question: Pick<GeneratedQuestion, "statement" | "optionA" | "serviceCode">): string {
  return [
    normalizeStatementKey(question.statement),
    normalizeStatementKey(question.optionA),
    normalizeStatementKey(question.serviceCode),
  ].join("|");
}

function cleanText(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyTruncatedText(value: string): boolean {
  if (!value) {
    return true;
  }

  const normalized = value.trim();
  if (normalized.length < 40) {
    return true;
  }

  if (/\.{3,}$/.test(normalized)) {
    return true;
  }

  if (!/[.!?)]$/.test(normalized)) {
    const trailingToken = normalized.split(/\s+/).pop()?.toLowerCase() ?? "";
    if (["de", "da", "do", "das", "dos", "e", "ou", "para", "com", "que", "em"].includes(trailingToken)) {
      return true;
    }
  }

  return false;
}

function isValidOptionLabel(value: string): value is "A" | "B" | "C" | "D" | "E" {
  return value === "A" || value === "B" || value === "C" || value === "D" || value === "E";
}

function preprocessExtractedText(rawText: string): string {
  return rawText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/([A-Za-z\u00C0-\u024F])\-\s*\n\s*([A-Za-z\u00C0-\u024F])/g, "$1$2")
    .replace(/\n\s*(\d{1,3})\s*(?=\n\s*(?:Pergunta|Quest[aã]o|\d{1,3}\s*[\)\.\-:]))/gim, "\n")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function extractQuestionBlocksFromText(rawText: string): TaggedQuestionBlock[] {
  const text = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!text) {
    return [];
  }

  const markerRegex = /(?:^|\n)\s*(?:pergunta\s+|quest[aã]o\s*)?\d{1,3}\s*[\)\.\-:]/gim;
  const starts: number[] = [];

  for (const match of text.matchAll(markerRegex)) {
    if (typeof match.index !== "number") {
      continue;
    }

    const marker = match[0];
    const markerStart = marker.startsWith("\n") ? match.index + 1 : match.index;
    starts.push(markerStart);
  }

  if (starts.length === 0) {
    return [];
  }

  const blocks: TaggedQuestionBlock[] = [];
  for (let index = 0; index < starts.length; index += 1) {
    const start = starts[index];
    const end = index + 1 < starts.length ? starts[index + 1] : text.length;
    const content = text.slice(start, end).trim();
    if (content.length >= 60) {
      blocks.push({
        qid: index + 1,
        content,
      });
    }
  }

  return blocks;
}

function chunkQuestionBlocksSemantically(blocks: TaggedQuestionBlock[]): TaggedQuestionBlock[][] {
  if (blocks.length === 0) {
    return [];
  }

  const chunks: TaggedQuestionBlock[][] = [];
  let current: TaggedQuestionBlock[] = [];
  let currentLength = 0;

  for (const block of blocks) {
    const blockLength = block.content.length + 20;
    const nextCount = current.length + 1;
    const nextLength = currentLength + blockLength;
    const overflowByCount = nextCount > EXTRACT_QUESTIONS_PER_CHUNK;
    const overflowByChars = nextLength > MAX_EXTRACT_CHUNK_CHARS;

    if (current.length > 0 && (overflowByCount || overflowByChars)) {
      chunks.push(current);
      current = [block];
      currentLength = blockLength;
      continue;
    }

    current.push(block);
    currentLength = nextLength;
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
}

function splitTextByCharLimit(text: string, maxChars: number): string[] {
  const clean = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!clean) {
    return [];
  }

  if (clean.length <= maxChars) {
    return [clean];
  }

  const chunks: string[] = [];
  for (let index = 0; index < clean.length; index += maxChars) {
    chunks.push(clean.slice(index, index + maxChars).trim());
  }

  return chunks.filter((item) => item.length > 0);
}

async function preprocessChunkWithAi(input: {
  certification: CertificationContext;
  sourceChunk: string;
}): Promise<string> {
  const prompt = `
Voce recebera um lote de questoes OCR de simulado AWS.

Objetivo:
- Limpar ruido de OCR sem criar questoes novas.
- Corrigir palavras quebradas por hifenizacao de linha.
- Reorganizar o texto de forma clara mantendo o conteudo original.

Regras obrigatorias:
- Nao invente enunciados, alternativas ou respostas.
- Nao remova questoes validas.
- Preserve numeracao existente quando houver.
- Retorne SOMENTE texto limpo (sem JSON, sem markdown).

Lote OCR:
${input.sourceChunk}
`;

  const cleaned = (await generateContentWithQuotaProtection(prompt)).trim();
  return cleaned || input.sourceChunk;
}

function sanitizeGeneratedQuestion(
  question: GeneratedQuestion,
  allowedServiceCodes: Set<string>,
  fallbackDifficulty: StudyQuestionDifficulty,
): SanitizationResult | SanitizationFailure {
  const statement = cleanText(question.statement);
  const serviceCode = cleanText(question.serviceCode).toUpperCase();
  const difficulty = normalizeDifficulty(question.difficulty ?? fallbackDifficulty);
  const questionType = normalizeQuestionType(question.questionType);
  const optionA = cleanText(question.optionA);
  const optionB = cleanText(question.optionB);
  const optionC = cleanText(question.optionC);
  const optionD = cleanText(question.optionD);
  const optionE = cleanText(question.optionE);
  const correctOption = normalizeCorrectOption(cleanText(question.correctOption || "A"));
  const correctOptions = normalizeCorrectOptions(question.correctOptions, correctOption, questionType);
  const explanationA = cleanText(question.explanationA) || "Sem explicacao.";
  const explanationB = cleanText(question.explanationB) || "Sem explicacao.";
  const explanationC = cleanText(question.explanationC) || "Sem explicacao.";
  const explanationD = cleanText(question.explanationD) || "Sem explicacao.";
  const explanationE = cleanText(question.explanationE) || "Sem explicacao.";

  if (!allowedServiceCodes.has(serviceCode)) {
    return {
      reason: "invalid_service_code",
      detail: `Service code invalido: ${serviceCode || "(vazio)"}`,
    };
  }

  if (statement.length < 20) {
    return {
      reason: "invalid_statement",
      detail: "Enunciado abaixo do minimo.",
    };
  }

  if (isLikelyTruncatedText(statement)) {
    return {
      reason: "statement_truncated",
      detail: "Enunciado possivelmente truncado.",
    };
  }

  const requiredOptions = [optionA, optionB, optionC, optionD];
  if (requiredOptions.some((item) => item.length < 4)) {
    return {
      reason: "missing_required_options",
      detail: "Alternativas A-D incompletas.",
    };
  }

  const availableOptions = new Set<"A" | "B" | "C" | "D" | "E">(["A", "B", "C", "D"]);
  if (optionE.length >= 4) {
    availableOptions.add("E");
  }

  if (!availableOptions.has(correctOption)) {
    return {
      reason: "invalid_correct_answer",
      detail: "Alternativa correta nao corresponde a opcoes disponiveis.",
    };
  }

  if (questionType === "multi") {
    const validCorrectOptions = correctOptions.filter((item) => isValidOptionLabel(item) && availableOptions.has(item));
    if (validCorrectOptions.length < 2) {
      return {
        reason: "invalid_correct_answer",
        detail: "Questao multipla com menos de duas corretas validas.",
      };
    }
  }

  if (explanationA.length < 8 || explanationB.length < 8 || explanationC.length < 8 || explanationD.length < 8) {
    return {
      reason: "empty_explanations",
      detail: "Explicacoes incompletas nas opcoes obrigatorias.",
    };
  }

  const sanitizedQuestion: GeneratedQuestion = {
    statement,
    serviceCode,
    difficulty,
    questionType,
    optionA,
    optionB,
    optionC,
    optionD,
    optionE,
    correctOption,
    correctOptions: questionType === "multi" ? correctOptions : [correctOption],
    explanationA,
    explanationB,
    explanationC,
    explanationD,
    explanationE,
  };

  return {
    question: sanitizedQuestion,
    dedupeKey: buildQuestionDedupeKey(sanitizedQuestion),
  };
}

async function generateQuestionsWithAi(input: {
  certification: CertificationContext;
  usage: StudyQuestionUsage;
  difficulty: StudyQuestionDifficulty | "mixed";
  desiredCount: number;
  services: ServiceContext[];
  sourceText?: string;
}): Promise<GeneratedQuestion[]> {
  const servicesList = input.services.map((service) => `${service.code}: ${service.name}`).join("\n");
  const guideContext = input.certification.examGuide
    ? String(input.certification.examGuide).trim().slice(0, MAX_GUIDE_CONTEXT_CHARS)
    : "";
  const sourceContext = input.sourceText ? String(input.sourceText).trim().slice(0, MAX_SOURCE_CONTEXT_CHARS) : "";

  const prompt = `
Voce e um especialista em preparacao para certificacoes AWS.
Crie perguntas objetivas e coerentes para estudo.

Contexto:
- Certificacao alvo: ${input.certification.code} - ${input.certification.name}
- Tipo de uso: ${input.usage}
- Dificuldade: ${input.difficulty}
- Quantidade: ${input.desiredCount}

${guideContext ? `Guia oficial da certificacao (use como referencia principal):\n${guideContext}\n` : ""}
${sourceContext ? `Texto extraido de simulado/documento fonte (priorize este contexto):\n${sourceContext}\n` : ""}

Servicos permitidos (USE SOMENTE ESTES CODES):
${servicesList}

Regras obrigatorias:
- Retorne APENAS um array JSON valido.
- Nao use markdown.
- Cada item deve seguir este formato:
{
  "statement": "...",
  "serviceCode": "...",
  "difficulty": "easy|medium|hard",
  "questionType": "single|multi",
  "optionA": "...",
  "optionB": "...",
  "optionC": "...",
  "optionD": "...",
  "optionE": "...",
  "correctOption": "A|B|C|D|E",
  "correctOptions": ["A","C"],
  "explanationA": "...",
  "explanationB": "...",
  "explanationC": "...",
  "explanationD": "...",
  "explanationE": "..."
}
- A questao deve realmente tratar do serviceCode escolhido.
- Em questao multi, use no minimo 2 alternativas corretas em correctOptions.
- Em questao single, use somente 1 alternativa em correctOptions.
- As alternativas incorretas devem ser plausiveis e tecnicamente distintas.
- Nao invente serviceCode fora da lista permitida.
- Use portugues brasileiro.
`;

  const text = await generateContentWithQuotaProtection(prompt);
  const items = tryParseJsonArray(text);

  if (items.length === 0) {
    return [];
  }

  return items as GeneratedQuestion[];
}

async function extractExistingQuestionsWithAi(input: {
  certification: CertificationContext;
  services: ServiceContext[];
  sourceText: string;
  onBatchProgress?: (current: number, total: number) => Promise<void> | void;
}): Promise<GeneratedQuestion[]> {
  const servicesList = input.services.map((service) => `${service.code}: ${service.name}`).join("\n");
  const guideContext = input.certification.examGuide
    ? String(input.certification.examGuide).trim().slice(0, MAX_GUIDE_CONTEXT_CHARS)
    : "";

  const preprocessedSourceText = preprocessExtractedText(input.sourceText);
  const taggedBlocks = extractQuestionBlocksFromText(preprocessedSourceText);
  const semanticChunks = chunkQuestionBlocksSemantically(taggedBlocks);
  const fallbackChunks = splitTextByCharLimit(preprocessedSourceText, MAX_EXTRACT_CHUNK_CHARS);
  const totalChunks = semanticChunks.length > 0 ? semanticChunks.length : fallbackChunks.length;

  devAuditLog("study.extract-existing.chunk-plan", {
    certificationCode: input.certification.code,
    taggedBlocks: taggedBlocks.length,
    semanticChunks: semanticChunks.length,
    fallbackChunks: fallbackChunks.length,
    usingSemanticChunks: semanticChunks.length > 0,
  });

  const extracted: GeneratedQuestion[] = [];

  async function processTaggedChunk(chunkBlocks: TaggedQuestionBlock[]): Promise<void> {
    const chunkInput = chunkBlocks.map((block) => `[QID:${block.qid}]\n${block.content}`).join("\n\n");
    const cleanedChunk = await preprocessChunkWithAi({
      certification: input.certification,
      sourceChunk: chunkInput,
    });

    const buildPrompt = (batchText: string) =>
      `
Voce e um especialista em certificacoes AWS.
Recebera texto OCR de questoes de simulado.

Objetivo:
- Extrair as questoes que JA EXISTEM no texto.
- Nao criar novas questoes.
- Nao alterar o sentido das alternativas.
- Completar metadados para o app (serviceCode, difficulty e explicacoes) com base no contexto tecnico.

Contexto da certificacao:
- ${input.certification.code} - ${input.certification.name}

${guideContext ? `Guia oficial para contexto de enriquecimento:\n${guideContext}\n` : ""}

Servicos permitidos (serviceCode):
${servicesList}

Texto OCR do lote:
${batchText}

Regras obrigatorias:
- Retorne APENAS um array JSON valido (sem markdown).
- Nao invente questoes fora do texto recebido.
- Se uma questao estiver incompleta (sem alternativas suficientes), descarte.
- Se o lote tiver tags [QID:N], mantenha o mesmo QID no item de saida.
- Preserve o enunciado e alternativas no idioma original do texto (portugues).
- ` +
      `Cada item precisa ter exatamente este formato:
{
  "qid": 1,
  "statement": "...",
  "serviceCode": "...",
  "difficulty": "easy|medium|hard",
  "questionType": "single|multi",
  "optionA": "...",
  "optionB": "...",
  "optionC": "...",
  "optionD": "...",
  "optionE": "...",
  "correctOption": "A|B|C|D|E",
  "correctOptions": ["A","C"],
  "explanationA": "...",
  "explanationB": "...",
  "explanationC": "...",
  "explanationD": "...",
  "explanationE": "..."
}
`;

    const parseTagged = (raw: string) => {
      const parsed = tryParseJsonArray(raw) as Array<GeneratedQuestion & { qid?: number | string }>;
      return parsed
        .map((item) => ({
          qid: typeof item.qid === "number" ? item.qid : Number(item.qid),
          question: item,
        }))
        .filter((item) => Number.isFinite(item.qid) && item.qid > 0);
    };

    const firstResponse = await generateContentWithQuotaProtection(buildPrompt(cleanedChunk));
    const firstItems = parseTagged(firstResponse);
    const covered = new Set(firstItems.map((item) => item.qid));

    const missingBlocks = chunkBlocks.filter((block) => !covered.has(block.qid));
    let mergedItems = [...firstItems];

    if (missingBlocks.length > 0) {
      const retryInput = missingBlocks.map((block) => `[QID:${block.qid}]\n${block.content}`).join("\n\n");
      const retryResponse = await generateContentWithQuotaProtection(buildPrompt(retryInput));
      const retryItems = parseTagged(retryResponse).filter((item) => !covered.has(item.qid));
      mergedItems = [...mergedItems, ...retryItems];
    }

    if (mergedItems.length === 0) {
      return;
    }

    devAuditLog("study.extract-existing.chunk-result", {
      chunkBlocks: chunkBlocks.length,
      firstPass: firstItems.length,
      missingAfterFirstPass: missingBlocks.length,
      mergedItems: mergedItems.length,
    });

    extracted.push(...mergedItems.map((item) => item.question));
  }

  async function processFallbackChunk(chunkText: string): Promise<void> {
    const cleanedChunk = await preprocessChunkWithAi({
      certification: input.certification,
      sourceChunk: chunkText,
    });

    const prompt = `
Voce e um especialista em certificacoes AWS.
Recebera texto OCR de questoes de simulado.

Objetivo:
- Extrair as questoes que JA EXISTEM no texto.
- Nao criar novas questoes.
- Nao alterar o sentido das alternativas.
- Completar metadados para o app (serviceCode, difficulty e explicacoes) com base no contexto tecnico.

Contexto da certificacao:
- ${input.certification.code} - ${input.certification.name}

${guideContext ? `Guia oficial para contexto de enriquecimento:\n${guideContext}\n` : ""}

Servicos permitidos (serviceCode):
${servicesList}

Texto OCR do lote:
${cleanedChunk}

Regras obrigatorias:
- Retorne APENAS um array JSON valido (sem markdown).
- Nao invente questoes fora do texto recebido.
- Se uma questao estiver incompleta (sem alternativas suficientes), descarte.
- Preserve o enunciado e alternativas no idioma original do texto (portugues).
- Cada item precisa ter exatamente este formato:
{
  "statement": "...",
  "serviceCode": "...",
  "difficulty": "easy|medium|hard",
  "questionType": "single|multi",
  "optionA": "...",
  "optionB": "...",
  "optionC": "...",
  "optionD": "...",
  "optionE": "...",
  "correctOption": "A|B|C|D|E",
  "correctOptions": ["A","C"],
  "explanationA": "...",
  "explanationB": "...",
  "explanationC": "...",
  "explanationD": "...",
  "explanationE": "..."
}
`;

    const text = await generateContentWithQuotaProtection(prompt);
    const items = tryParseJsonArray(text);

    if (items.length === 0) {
      return;
    }

    extracted.push(...(items as GeneratedQuestion[]));
  }

  for (let index = 0; index < totalChunks; index += 1) {
    await input.onBatchProgress?.(index + 1, totalChunks);

    if (semanticChunks.length > 0) {
      await processTaggedChunk(semanticChunks[index]);
      continue;
    }

    await processFallbackChunk(fallbackChunks[index]);
  }

  return extracted;
}

async function saveGeneratedQuestions(input: {
  certification: CertificationContext;
  usage: StudyQuestionUsage;
  generated: GeneratedQuestion[];
  serviceByCode: Map<string, { id: string; code: string }>;
  sourceUploadedFileId?: string;
}) {
  let savedCount = 0;

  for (let index = 0; index < input.generated.length; index += 1) {
    const item = input.generated[index];
    const service = input.serviceByCode.get(item.serviceCode);

    if (!service) {
      continue;
    }

    const nowKey = `${Date.now()}-${index}-${Math.floor(Math.random() * 100000)}`;
    const externalId = `AI-${input.certification.code}-${input.usage}-${nowKey}`;

    await prisma.studyQuestion.create({
      data: {
        externalId,
        statement: item.statement,
        usage: input.usage,
        difficulty: item.difficulty,
        topic: item.serviceCode,
        questionType: item.questionType === "multi" ? "multi" : "single",
        optionA: item.optionA,
        optionB: item.optionB,
        optionC: item.optionC,
        optionD: item.optionD,
        optionE: item.optionE || null,
        correctOption: item.correctOption,
        correctOptions: item.correctOptions,
        explanationA: item.explanationA,
        explanationB: item.explanationB,
        explanationC: item.explanationC,
        explanationD: item.explanationD,
        explanationE: item.explanationE || null,
        active: true,
        certificationPresetId: input.certification.id,
        awsServiceId: service.id,
        sourceUploadedFileId: input.sourceUploadedFileId ?? null,
      },
    });

    savedCount += 1;
  }

  return savedCount;
}

export async function ensureQuestionPool(input: EnsurePoolInput): Promise<void> {
  const certification = await prisma.certificationPreset.findUnique({
    where: { id: input.certification.id },
    select: {
      id: true,
      code: true,
      name: true,
      examGuide: true,
    },
  });

  if (!certification) {
    return;
  }

  const candidateServices = await prisma.awsService.findMany({
    where: {
      active: true,
      ...(input.selectedServiceCodes && input.selectedServiceCodes.length > 0
        ? { code: { in: input.selectedServiceCodes } }
        : {}),
    },
    select: {
      id: true,
      code: true,
      name: true,
    },
    take: 30,
  });

  if (candidateServices.length === 0) {
    return;
  }

  const serviceByCode = new Map(
    candidateServices.map((service) => [service.code, { id: service.id, code: service.code }]),
  );
  const allowedServiceCodes = new Set(candidateServices.map((service) => service.code));

  const existingCount = await prisma.studyQuestion.count({
    where: {
      active: true,
      certificationPresetId: input.certification.id,
      usage: { in: input.usage === "KC" ? ["KC", "BOTH"] : ["SIMULADO", "BOTH"] },
      difficulty: input.difficulty,
      awsService: { code: { in: Array.from(allowedServiceCodes) } },
    },
  });

  if (existingCount >= input.desiredCount) {
    return;
  }

  const missing = input.desiredCount - existingCount;
  const generationTarget = Math.max(5, Math.min(30, missing + 5));

  const generatedRaw = await generateQuestionsWithAi({
    certification,
    usage: input.usage,
    difficulty: input.difficulty,
    desiredCount: generationTarget,
    services: candidateServices,
  });

  if (generatedRaw.length === 0) {
    return;
  }

  const sanitized = generatedRaw
    .map((item) => sanitizeGeneratedQuestion(item, allowedServiceCodes, input.difficulty))
    .filter((item): item is SanitizationResult => "question" in item)
    .map((item) => item.question);

  if (sanitized.length === 0) {
    return;
  }

  await saveGeneratedQuestions({
    certification,
    usage: input.usage,
    generated: sanitized,
    serviceByCode,
  });
}

export async function ingestQuestionsFromPdf(input: {
  certificationCode: string;
  extractedText: string;
  desiredCount?: number;
  mode?: IngestMode;
  sourceUploadedFileId?: string;
  onProgress?: (progress: {
    status: "EXTRACTING" | "GENERATING" | "SAVING" | "COMPLETED";
    progressPercent: number;
    message: string;
    generatedCount?: number;
    savedCount?: number;
    rejectedCount?: number;
  }) => Promise<void> | void;
}) {
  const certification = await prisma.certificationPreset.findUnique({
    where: { code: input.certificationCode },
    select: {
      id: true,
      code: true,
      name: true,
      examGuide: true,
    },
  });

  if (!certification) {
    throw new Error("Certificacao invalida.");
  }

  if (!certification.examGuide || certification.examGuide.trim().length < 120) {
    throw new Error(
      "Antes de enviar PDFs de simulado, faca upload do Exam Guide oficial da certificacao no painel admin.",
    );
  }

  const candidateServices = await prisma.awsService.findMany({
    where: { active: true },
    select: { id: true, code: true, name: true },
    take: 45,
  });

  if (candidateServices.length === 0) {
    throw new Error("Nenhum servico AWS ativo encontrado para gerar questoes.");
  }

  const mode: IngestMode = input.mode ?? "generate-new";

  let generatedRaw: GeneratedQuestion[] = [];

  if (mode === "extract-existing") {
    await input.onProgress?.({
      status: "EXTRACTING",
      progressPercent: 45,
      message: "Extraindo questoes existentes do PDF...",
    });

    generatedRaw = await extractExistingQuestionsWithAi({
      certification,
      services: candidateServices,
      sourceText: input.extractedText,
      onBatchProgress: async (current, total) => {
        const progressPercent = Math.min(78, 45 + Math.round((current / total) * 33));
        await input.onProgress?.({
          status: "EXTRACTING",
          progressPercent,
          message: `Extraindo lote ${current}/${total} de questoes do simulado...`,
        });
      },
    });
  } else {
    const desiredCount = Math.max(5, Math.min(50, Math.round(input.desiredCount ?? 20)));

    await input.onProgress?.({
      status: "GENERATING",
      progressPercent: 60,
      message: "Gerando questoes com IA...",
    });

    generatedRaw = await generateQuestionsWithAi({
      certification,
      usage: "BOTH",
      difficulty: "mixed",
      desiredCount,
      services: candidateServices,
      sourceText: input.extractedText,
    });
  }

  if (generatedRaw.length === 0) {
    throw new Error("Nao foi possivel extrair questoes validas a partir do PDF.");
  }

  const serviceByCode = new Map(
    candidateServices.map((service) => [service.code, { id: service.id, code: service.code }]),
  );
  const allowedServiceCodes = new Set(candidateServices.map((service) => service.code));
  const rejectionReasons: Record<QuestionRejectionReason, number> = {
    invalid_service_code: 0,
    invalid_statement: 0,
    statement_truncated: 0,
    missing_required_options: 0,
    invalid_correct_answer: 0,
    empty_explanations: 0,
    duplicate_question: 0,
  };
  const dedupe = new Set<string>();
  const sanitized: GeneratedQuestion[] = [];

  for (const item of generatedRaw) {
    const result = sanitizeGeneratedQuestion(item, allowedServiceCodes, "medium");
    if (!("question" in result)) {
      rejectionReasons[result.reason] += 1;
      devAuditLog("study.ingest.question-rejected", {
        certificationCode: certification.code,
        reason: result.reason,
        detail: result.detail,
      });
      continue;
    }

    if (!result.dedupeKey || dedupe.has(result.dedupeKey)) {
      rejectionReasons.duplicate_question += 1;
      continue;
    }

    dedupe.add(result.dedupeKey);
    sanitized.push(result.question);
  }

  const finalSanitized =
    mode === "generate-new" && typeof input.desiredCount === "number"
      ? sanitized.slice(0, Math.max(5, Math.min(50, Math.round(input.desiredCount))))
      : sanitized;

  if (finalSanitized.length === 0) {
    throw new Error("As questoes geradas ficaram invalidas apos sanitizacao.");
  }

  const summary: IngestionSanitizationSummary = {
    rejectedCount: generatedRaw.length - finalSanitized.length,
    rejectionReasons,
  };

  await input.onProgress?.({
    status: "SAVING",
    progressPercent: 88,
    message: `Salvando questoes no banco (${summary.rejectedCount} rejeitadas)...`,
    generatedCount: generatedRaw.length,
    rejectedCount: summary.rejectedCount,
  });

  const savedCount = await saveGeneratedQuestions({
    certification,
    usage: "BOTH",
    generated: finalSanitized,
    serviceByCode,
    sourceUploadedFileId: input.sourceUploadedFileId,
  });

  await input.onProgress?.({
    status: "COMPLETED",
    progressPercent: 100,
    message: "Ingestao concluida com sucesso.",
    generatedCount: generatedRaw.length,
    savedCount,
    rejectedCount: summary.rejectedCount,
  });

  devAuditLog("study.ingest.summary", {
    certificationCode: certification.code,
    mode,
    generatedRaw: generatedRaw.length,
    savedCount,
    rejectedCount: summary.rejectedCount,
    rejectionReasons: summary.rejectionReasons,
  });

  return {
    certificationCode: certification.code,
    generatedCount: generatedRaw.length,
    savedCount,
    rejectedCount: summary.rejectedCount,
    rejectionReasons: summary.rejectionReasons,
  };
}
