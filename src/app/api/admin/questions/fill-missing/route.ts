import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getAiModel } from "@/lib/ai";
import { prisma } from "@/lib/prisma";

type FillBody = {
  batchSize?: number;
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
  questionAwsServices: Array<{ serviceId: string }>;
};

type AiSuggestion = {
  id: string;
  topic?: string;
  serviceCodes?: string[];
};

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseBatchSize(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 10;
  }

  return Math.min(10, Math.floor(parsed));
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

  const batchSize = parseBatchSize(body.batchSize);
  const dryRun = Boolean(body.dryRun);

  const candidates = (await prisma.studyQuestion.findMany({
    where: {
      OR: [
        { topic: "" },
        {
          questionAwsServices: { none: {} },
        },
      ],
    },
    orderBy: [{ updatedAt: "asc" }],
    take: batchSize,
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
      questionAwsServices: {
        select: {
          serviceId: true,
        },
      },
    },
  })) as QuestionCandidate[];

  if (candidates.length === 0) {
    return NextResponse.json({
      ok: true,
      batchSize,
      processed: 0,
      updated: 0,
      dryRun,
      details: [],
      message: "Nenhuma questao pendente (sem topico ou sem servico relacionado).",
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

  const servicesPrompt = services.map((service) => `${service.code}: ${service.name}`).join("\n");

  const questionsPrompt = candidates
    .map((question, index) => {
      const missingTopic = cleanText(question.topic).length === 0;
      const missingServices = question.questionAwsServices.length === 0;
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
    "- Nao invente campos extras.",
    "- Inclua todos os ids recebidos.",
    "\nLista de servicos permitidos (code: name):",
    servicesPrompt,
    "\nQuestoes:",
    questionsPrompt,
  ].join("\n");

  let suggestions: AiSuggestion[] = [];
  try {
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
  const serviceByCode = new Map(services.map((service) => [service.code.toUpperCase(), service]));

  let updated = 0;
  const details: Array<{
    id: string;
    externalId: string;
    topicUpdated: boolean;
    servicesUpdated: boolean;
    topic: string;
    serviceCodes: string[];
  }> = [];

  for (const question of candidates) {
    const suggestion = suggestionById.get(question.id);
    const hasMissingTopic = cleanText(question.topic).length === 0;
    const hasMissingServices = question.questionAwsServices.length === 0;

    const suggestedTopic = cleanText(suggestion?.topic);
    const validServiceCodes = Array.from(new Set((suggestion?.serviceCodes ?? []).map((code) => code.toUpperCase())))
      .filter((code) => serviceByCode.has(code))
      .slice(0, 2);

    const shouldUpdateTopic = hasMissingTopic && suggestedTopic.length > 0;
    const shouldUpdateServices = hasMissingServices && validServiceCodes.length > 0;

    details.push({
      id: question.id,
      externalId: question.externalId,
      topicUpdated: shouldUpdateTopic,
      servicesUpdated: shouldUpdateServices,
      topic: shouldUpdateTopic ? suggestedTopic : question.topic,
      serviceCodes: shouldUpdateServices ? validServiceCodes : [],
    });

    if (!shouldUpdateTopic && !shouldUpdateServices) {
      continue;
    }

    if (!dryRun) {
      await prisma.$transaction(async (tx) => {
        const primaryService = shouldUpdateServices ? (serviceByCode.get(validServiceCodes[0]) ?? null) : null;

        await tx.studyQuestion.update({
          where: { id: question.id },
          data: {
            ...(shouldUpdateTopic ? { topic: suggestedTopic } : {}),
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
    }

    updated += 1;
  }

  return NextResponse.json({
    ok: true,
    batchSize,
    processed: candidates.length,
    updated,
    dryRun,
    details,
  });
}
