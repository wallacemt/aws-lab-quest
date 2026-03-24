import { StudyQuestionDifficulty, StudyQuestionUsage } from "@prisma/client";
import { getAiModel } from "@/lib/ai";
import { prisma } from "@/lib/prisma";

const MAX_GUIDE_CONTEXT_CHARS = 4_500;
const MAX_SOURCE_CONTEXT_CHARS = 7_500;
const MAX_EXTRACT_CHUNK_CHARS = 6_500;
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
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  optionE?: string;
  correctOption: "A" | "B" | "C" | "D" | "E";
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

function extractQuestionBlocksFromText(rawText: string): string[] {
  const text = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!text) {
    return [];
  }

  const markerRegex = /(?:^|\n)\s*(?:quest[aã]o\s*)?\d{1,3}\s*[\)\.\-:]/gim;
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
    return [text];
  }

  const blocks: string[] = [];
  for (let index = 0; index < starts.length; index += 1) {
    const start = starts[index];
    const end = index + 1 < starts.length ? starts[index + 1] : text.length;
    const block = text.slice(start, end).trim();
    if (block.length >= 60) {
      blocks.push(block);
    }
  }

  return blocks;
}

function splitTextByCharLimit(text: string, maxChars: number): string[] {
  const clean = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!clean) {
    return [];
  }

  if (clean.length <= maxChars) {
    return [clean];
  }

  const paragraphs = clean
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  if (paragraphs.length === 0) {
    const chunks: string[] = [];
    for (let index = 0; index < clean.length; index += maxChars) {
      chunks.push(clean.slice(index, index + maxChars));
    }
    return chunks;
  }

  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if (paragraph.length > maxChars) {
      if (current) {
        chunks.push(current.trim());
        current = "";
      }

      for (let index = 0; index < paragraph.length; index += maxChars) {
        chunks.push(paragraph.slice(index, index + maxChars).trim());
      }

      continue;
    }

    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length > maxChars) {
      chunks.push(current.trim());
      current = paragraph;
    } else {
      current = candidate;
    }
  }

  if (current) {
    chunks.push(current.trim());
  }

  return chunks;
}

function sanitizeGeneratedQuestion(
  question: GeneratedQuestion,
  allowedServiceCodes: Set<string>,
  fallbackServiceCode: string,
  fallbackDifficulty: StudyQuestionDifficulty,
): GeneratedQuestion {
  const serviceCode = allowedServiceCodes.has(question.serviceCode) ? question.serviceCode : fallbackServiceCode;
  const difficulty = normalizeDifficulty(question.difficulty ?? fallbackDifficulty);

  return {
    statement: String(question.statement ?? "Questao AWS").trim(),
    serviceCode,
    difficulty,
    optionA: String(question.optionA ?? "Opcao A").trim(),
    optionB: String(question.optionB ?? "Opcao B").trim(),
    optionC: String(question.optionC ?? "Opcao C").trim(),
    optionD: String(question.optionD ?? "Opcao D").trim(),
    optionE: question.optionE ? String(question.optionE).trim() : "",
    correctOption: normalizeCorrectOption(String(question.correctOption ?? "A").trim()),
    explanationA: String(question.explanationA ?? "Sem explicacao.").trim(),
    explanationB: String(question.explanationB ?? "Sem explicacao.").trim(),
    explanationC: String(question.explanationC ?? "Sem explicacao.").trim(),
    explanationD: String(question.explanationD ?? "Sem explicacao.").trim(),
    explanationE: question.explanationE ? String(question.explanationE).trim() : "Sem explicacao.",
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
  "optionA": "...",
  "optionB": "...",
  "optionC": "...",
  "optionD": "...",
  "optionE": "...",
  "correctOption": "A|B|C|D|E",
  "explanationA": "...",
  "explanationB": "...",
  "explanationC": "...",
  "explanationD": "...",
  "explanationE": "..."
}
- A questao deve realmente tratar do serviceCode escolhido.
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

  const blocks = extractQuestionBlocksFromText(input.sourceText);
  const chunks: string[] = [];

  if (blocks.length <= 1) {
    chunks.push(...splitTextByCharLimit(input.sourceText, MAX_EXTRACT_CHUNK_CHARS));
  } else {
    const perChunk = 8;
    for (let index = 0; index < blocks.length; index += perChunk) {
      const combined = blocks.slice(index, index + perChunk).join("\n\n");
      chunks.push(...splitTextByCharLimit(combined, MAX_EXTRACT_CHUNK_CHARS));
    }
  }

  const extracted: GeneratedQuestion[] = [];

  for (let index = 0; index < chunks.length; index += 1) {
    await input.onBatchProgress?.(index + 1, chunks.length);

    const prompt =
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
${chunks[index]}

Regras obrigatorias:
- Retorne APENAS um array JSON valido (sem markdown).
- Nao invente questoes fora do texto recebido.
- Se uma questao estiver incompleta (sem alternativas suficientes), descarte.
- Preserve o enunciado e alternativas no idioma original do texto (portugues).
- ` +
      `Cada item precisa ter exatamente este formato:
{
  "statement": "...",
  "serviceCode": "...",
  "difficulty": "easy|medium|hard",
  "optionA": "...",
  "optionB": "...",
  "optionC": "...",
  "optionD": "...",
  "optionE": "...",
  "correctOption": "A|B|C|D|E",
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
      continue;
    }

    extracted.push(...(items as GeneratedQuestion[]));
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
        optionA: item.optionA,
        optionB: item.optionB,
        optionC: item.optionC,
        optionD: item.optionD,
        optionE: item.optionE || null,
        correctOption: item.correctOption,
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
  const fallbackServiceCode = candidateServices[0].code;

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
    .map((item) => sanitizeGeneratedQuestion(item, allowedServiceCodes, fallbackServiceCode, input.difficulty))
    .filter((item) => item.statement.length > 10);

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
  const fallbackServiceCode = candidateServices[0].code;

  const dedupe = new Set<string>();
  const sanitized = generatedRaw
    .map((item) => sanitizeGeneratedQuestion(item, allowedServiceCodes, fallbackServiceCode, "medium"))
    .filter((item) => item.statement.length > 10)
    .filter((item) => {
      const key = normalizeStatementKey(item.statement);
      if (!key || dedupe.has(key)) {
        return false;
      }

      dedupe.add(key);
      return true;
    });

  const finalSanitized =
    mode === "generate-new" && typeof input.desiredCount === "number"
      ? sanitized.slice(0, Math.max(5, Math.min(50, Math.round(input.desiredCount))))
      : sanitized;

  if (finalSanitized.length === 0) {
    throw new Error("As questoes geradas ficaram invalidas apos sanitizacao.");
  }

  await input.onProgress?.({
    status: "SAVING",
    progressPercent: 88,
    message: "Salvando questoes no banco...",
    generatedCount: generatedRaw.length,
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
  });

  return {
    certificationCode: certification.code,
    generatedCount: finalSanitized.length,
    savedCount,
  };
}
