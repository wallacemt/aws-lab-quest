import { StudyQuestionDifficulty, StudyQuestionUsage } from "@prisma/client";
import { getAiModel } from "@/lib/ai";
import { prisma } from "@/lib/prisma";

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
  const model = getAiModel();

  const servicesList = input.services.map((service) => `${service.code}: ${service.name}`).join("\n");
  const guideContext = input.certification.examGuide
    ? String(input.certification.examGuide).trim().slice(0, 14_000)
    : "";
  const sourceContext = input.sourceText ? String(input.sourceText).trim().slice(0, 22_000) : "";

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

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const items = tryParseJsonArray(text);

  if (items.length === 0) {
    return [];
  }

  return items as GeneratedQuestion[];
}

async function saveGeneratedQuestions(input: {
  certification: CertificationContext;
  usage: StudyQuestionUsage;
  generated: GeneratedQuestion[];
  serviceByCode: Map<string, { id: string; code: string }>;
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

  const desiredCount = Math.max(5, Math.min(50, Math.round(input.desiredCount ?? 20)));

  await input.onProgress?.({
    status: "GENERATING",
    progressPercent: 60,
    message: "Gerando questoes com IA...",
  });

  const generatedRaw = await generateQuestionsWithAi({
    certification,
    usage: "BOTH",
    difficulty: "mixed",
    desiredCount,
    services: candidateServices,
    sourceText: input.extractedText,
  });

  if (generatedRaw.length === 0) {
    throw new Error("Nao foi possivel gerar questoes a partir do PDF.");
  }

  const serviceByCode = new Map(
    candidateServices.map((service) => [service.code, { id: service.id, code: service.code }]),
  );
  const allowedServiceCodes = new Set(candidateServices.map((service) => service.code));
  const fallbackServiceCode = candidateServices[0].code;

  const sanitized = generatedRaw
    .map((item) => sanitizeGeneratedQuestion(item, allowedServiceCodes, fallbackServiceCode, "medium"))
    .filter((item) => item.statement.length > 10)
    .slice(0, desiredCount);

  if (sanitized.length === 0) {
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
    generated: sanitized,
    serviceByCode,
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
    generatedCount: generatedRaw.length,
    savedCount,
  };
}
