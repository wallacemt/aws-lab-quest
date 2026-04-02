import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getAiModel } from "@/lib/ai";
import { prisma } from "@/lib/prisma";

const DEFAULT_CHUNK_SIZE = 10;
const MAX_CHUNK_SIZE = 10;
const DEFAULT_DELAY_MS = 1600;
const MAX_DELAY_MS = 30_000;
const MAX_TOTAL_PER_RUN = 200;

type FillBody = {
  // Backward compatibility with previous payload format.
  batchSize?: number;
  totalToProcess?: number;
  chunkSize?: number;
  delayMs?: number;
  dryRun?: boolean;
};

type QuestionCandidate = {
  id: string;
  externalId: string;
  statement: string;
  topic: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  optionE: string | null;
  awsServiceId: string | null;
  questionAwsServices: Array<{ serviceId: string }>;
};

type AiSuggestion = {
  id: string;
  topic?: string;
  serviceCodes?: string[];
};

type FillDetail = {
  id: string;
  externalId: string;
  attempted: boolean;
  topicUpdated: boolean;
  servicesUpdated: boolean;
  topic: string;
  serviceCodes: string[];
  note?: string;
};

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeTopic(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

function isPlaceholderTopic(value: string): boolean {
  const normalized = normalizeTopic(value);
  if (!normalized) {
    return true;
  }

  return normalized === "GENERAL" || normalized === "GERAL" || normalized === "TOPICO GERAL";
}

function isUsefulSuggestedTopic(value: string): boolean {
  const normalized = normalizeTopic(value);
  if (!normalized) {
    return false;
  }

  return !["GENERAL", "GERAL", "TOPICO GERAL", "AWS", "CLOUD"].includes(normalized);
}

function parseChunkSize(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_CHUNK_SIZE;
  }

  return Math.min(MAX_CHUNK_SIZE, Math.floor(parsed));
}

function parseTotalToProcess(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(MAX_TOTAL_PER_RUN, Math.floor(parsed));
}

function parseDelayMs(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_DELAY_MS;
  }

  return Math.min(MAX_DELAY_MS, Math.floor(parsed));
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildPendingWhere(excludedIds: string[] = []) {
  const missingConditions = [
    { topic: "" },
    { topic: "GENERAL" },
    { topic: "GERAL" },
    {
      AND: [{ awsServiceId: null }, { questionAwsServices: { none: {} } }],
    },
  ];

  if (excludedIds.length === 0) {
    return {
      OR: missingConditions,
    };
  }

  return {
    AND: [{ id: { notIn: excludedIds } }, { OR: missingConditions }],
  };
}

function extractJsonArray(text: string): unknown[] {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) {
    return [];
  }

  const raw = text.slice(start, end + 1);
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseAiSuggestions(text: string): AiSuggestion[] {
  const parsed = extractJsonArray(text);
  return parsed
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const typed = item as {
        id?: unknown;
        topic?: unknown;
        serviceCodes?: unknown;
      };

      const id = cleanText(typed.id);
      if (!id) {
        return null;
      }

      const topic = cleanText(typed.topic);
      const serviceCodes = Array.isArray(typed.serviceCodes)
        ? Array.from(
            new Set(
              typed.serviceCodes.map((value) => cleanText(value).toUpperCase()).filter((value) => value.length > 0),
            ),
          )
        : [];

      return {
        id,
        topic: topic || undefined,
        serviceCodes,
      } as AiSuggestion;
    })
    .filter((item): item is AiSuggestion => item !== null);
}

async function loadCandidates(take: number, excludedIds: string[]): Promise<QuestionCandidate[]> {
  return (await prisma.studyQuestion.findMany({
    where: buildPendingWhere(excludedIds),
    orderBy: [{ updatedAt: "asc" }],
    take,
    select: {
      id: true,
      externalId: true,
      statement: true,
      topic: true,
      optionA: true,
      optionB: true,
      optionC: true,
      optionD: true,
      optionE: true,
      awsServiceId: true,
      questionAwsServices: {
        select: {
          serviceId: true,
        },
      },
    },
  })) as QuestionCandidate[];
}

export async function POST(request: NextRequest) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  let body: FillBody;
  try {
    body = (await request.json().catch(() => ({}))) as FillBody;
  } catch {
    body = {};
  }

  const chunkSize = parseChunkSize(body.chunkSize ?? body.batchSize);
  const requestedTotal = parseTotalToProcess(body.totalToProcess ?? body.batchSize, chunkSize);
  const delayMs = parseDelayMs(body.delayMs);
  const dryRun = Boolean(body.dryRun);

  const pendingBefore = await prisma.studyQuestion.count({
    where: buildPendingWhere(),
  });

  if (pendingBefore === 0) {
    return NextResponse.json({
      ok: true,
      batchSize: chunkSize,
      requestedTotal,
      processed: 0,
      updated: 0,
      touched: 0,
      aiRequests: 0,
      pendingBefore,
      pendingAfter: 0,
      delayMs,
      dryRun,
      details: [],
      message: "Nenhuma questao pendente (sem topico ou sem servico relacionado).",
    });
  }

  const totalToProcess = Math.min(requestedTotal, pendingBefore);
  if (totalToProcess <= 0) {
    return NextResponse.json({
      ok: true,
      batchSize: chunkSize,
      requestedTotal,
      processed: 0,
      updated: 0,
      touched: 0,
      aiRequests: 0,
      pendingBefore,
      pendingAfter: pendingBefore,
      delayMs,
      dryRun,
      details: [],
      message: "Nada para processar no lote solicitado.",
    });
  }

  const services = await prisma.awsService.findMany({
    where: { active: true },
    orderBy: [{ code: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
    },
    take: 400,
  });

  if (services.length === 0) {
    return NextResponse.json(
      {
        error: "Nenhum servico AWS ativo disponivel para inferencia.",
      },
      { status: 400 },
    );
  }

  const serviceByCode = new Map(services.map((service) => [service.code.toUpperCase(), service]));
  const attemptedIds = new Set<string>();
  const details: FillDetail[] = [];

  let processed = 0;
  let updated = 0;
  let touched = 0;
  let aiRequests = 0;

  while (processed < totalToProcess) {
    const remaining = totalToProcess - processed;
    const take = Math.min(chunkSize, remaining);
    const chunk = await loadCandidates(take, Array.from(attemptedIds));

    if (chunk.length === 0) {
      break;
    }

    for (const question of chunk) {
      attemptedIds.add(question.id);
    }

    const servicesPrompt = services.map((service) => `${service.code}: ${service.name}`).join("\n");
    const questionsPrompt = chunk
      .map((question, index) => {
        const missingTopic = isPlaceholderTopic(question.topic);
        const missingServices = !question.awsServiceId && question.questionAwsServices.length === 0;
        return [
          `#${index + 1}`,
          `id: ${question.id}`,
          `externalId: ${question.externalId}`,
          `missingTopic: ${missingTopic}`,
          `missingServices: ${missingServices}`,
          `statement: ${question.statement}`,
          `options:`,
          `A) ${question.optionA}`,
          `B) ${question.optionB}`,
          `C) ${question.optionC}`,
          `D) ${question.optionD}`,
          ...(question.optionE ? [`E) ${question.optionE}`] : []),
        ].join("\n");
      })
      .join("\n\n");

    const prompt = [
      "Voce deve completar metadados de questoes AWS.",
      "Retorne SOMENTE um JSON array.",
      "Cada item do array deve seguir estritamente:",
      '{"id":"<id>","topic":"<topic curto>","serviceCodes":["<code1>","<code2>"]}',
      "Regras:",
      "- Use apenas serviceCodes da lista permitida.",
      "- serviceCodes deve ter no maximo 2 codigos.",
      "- topic deve ser curto e objetivo (2 a 5 palavras).",
      "- Nunca use topics genericos como GENERAL, GERAL, AWS ou CLOUD.",
      "- Nao invente campos extras.",
      "- Inclua todos os ids recebidos.",
      "\nLista de servicos permitidos (code: name):",
      servicesPrompt,
      "\nQuestoes:",
      questionsPrompt,
    ].join("\n");

    let suggestions: AiSuggestion[] = [];
    try {
      aiRequests += 1;
      const model = getAiModel();
      const raw = await model.generateContent(prompt);
      suggestions = parseAiSuggestions(raw.response.text());
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "Falha ao consultar modelo de IA.",
        },
        { status: 502 },
      );
    }

    const suggestionById = new Map(suggestions.map((item) => [item.id, item]));

    for (const question of chunk) {
      const suggestion = suggestionById.get(question.id);
      const hasMissingTopic = isPlaceholderTopic(question.topic);
      const hasMissingServices = !question.awsServiceId && question.questionAwsServices.length === 0;

      const suggestedTopic = cleanText(suggestion?.topic);
      const validTopic = isUsefulSuggestedTopic(suggestedTopic) ? suggestedTopic : "";
      const validServiceCodes = Array.from(
        new Set((suggestion?.serviceCodes ?? []).map((code) => cleanText(code).toUpperCase())),
      )
        .filter((code) => code.length > 0)
        .filter((code) => serviceByCode.has(code))
        .slice(0, 2);

      const shouldUpdateTopic = hasMissingTopic && validTopic.length > 0;
      const shouldUpdateServices = hasMissingServices && validServiceCodes.length > 0;

      let note: string | undefined;
      if (!suggestion) {
        note = "Sem sugestao da IA para o id.";
      } else if (!shouldUpdateTopic && !shouldUpdateServices) {
        note = "IA retornou dados insuficientes/invalidos para atualizacao.";
      }

      if (!dryRun) {
        if (shouldUpdateTopic || shouldUpdateServices) {
          await prisma.$transaction(async (tx) => {
            const primaryService = shouldUpdateServices ? (serviceByCode.get(validServiceCodes[0]) ?? null) : null;

            await tx.studyQuestion.update({
              where: { id: question.id },
              data: {
                ...(shouldUpdateTopic ? { topic: validTopic } : {}),
                ...(shouldUpdateServices ? { awsServiceId: primaryService?.id ?? null } : {}),
              },
            });

            if (shouldUpdateServices) {
              await tx.questionAwsService.deleteMany({
                where: { questionId: question.id },
              });

              const serviceRows = validServiceCodes
                .map((code) => serviceByCode.get(code))
                .filter((service): service is { id: string; code: string; name: string } => Boolean(service));

              if (serviceRows.length > 0) {
                await tx.questionAwsService.createMany({
                  data: serviceRows.map((service) => ({
                    questionId: question.id,
                    serviceId: service.id,
                  })),
                });
              }
            }
          });
        } else {
          // Touch row to move cursor forward in next executions when no valid update is possible.
          await prisma.studyQuestion.update({
            where: { id: question.id },
            data: { topic: question.topic },
          });
          touched += 1;
        }
      }

      if (shouldUpdateTopic || shouldUpdateServices) {
        updated += 1;
      }

      details.push({
        id: question.id,
        externalId: question.externalId,
        attempted: true,
        topicUpdated: shouldUpdateTopic,
        servicesUpdated: shouldUpdateServices,
        topic: shouldUpdateTopic ? validTopic : question.topic,
        serviceCodes: shouldUpdateServices ? validServiceCodes : [],
        ...(note ? { note } : {}),
      });
    }

    processed += chunk.length;

    if (processed < totalToProcess && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  const pendingAfter = await prisma.studyQuestion.count({
    where: buildPendingWhere(),
  });

  return NextResponse.json({
    ok: true,
    batchSize: chunkSize,
    requestedTotal: totalToProcess,
    processed,
    updated,
    touched,
    aiRequests,
    pendingBefore,
    pendingAfter,
    delayMs,
    dryRun,
    details,
  });
}

export async function GET(request: NextRequest) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  const pending = await prisma.studyQuestion.count({
    where: buildPendingWhere(),
  });

  return NextResponse.json({
    ok: true,
    pending,
    defaultChunkSize: DEFAULT_CHUNK_SIZE,
    maxChunkSize: MAX_CHUNK_SIZE,
    defaultDelayMs: DEFAULT_DELAY_MS,
    maxTotalPerRun: MAX_TOTAL_PER_RUN,
  });
}
