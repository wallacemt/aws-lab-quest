import { createHash, randomUUID, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { Prisma, StudyQuestionDifficulty, StudyQuestionUsage } from "@prisma/client";
import { auth } from "@/lib/auth";
import { extractJsonObject, getAiModel } from "@/lib/ai";
import { prisma } from "@/lib/prisma";
import { mapDbQuestionToStudyQuestion, pickRandomItems } from "@/lib/study-questions";

const OPTION_LABELS = ["A", "B", "C", "D", "E"] as const;

type Body = {
  topics?: string[];
  count?: number;
};

// Shape written by feedback-analysis.worker (WeakAreaReport.weakAreas JSON field).
type WeakAreaEntry = {
  dimension: "service" | "topic";
  dimensionId: string;
  correctRate: number;
};

type ParsedAiOption = {
  content: string;
  explanation: string | null;
  isCorrect: boolean;
};

type ParsedAiQuestion = {
  statement: string;
  topic: string;
  questionType: "single" | "multi";
  options: ParsedAiOption[];
};

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeOptionContent(value: string): string {
  return normalizeText(value).replace(/^\(?[A-Ea-e1-5]\)?\s*[\)\.\-:]\s+/, "");
}

function extractJsonArray(text: string): string | null {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  return text.slice(start, end + 1);
}

function parseAiPayload(rawText: string): unknown[] {
  const jsonObject = extractJsonObject(rawText);
  if (jsonObject) {
    try {
      const parsed = JSON.parse(jsonObject) as { questions?: unknown };
      if (Array.isArray(parsed.questions)) {
        return parsed.questions;
      }
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // fall through to array extraction
    }
  }

  const jsonArray = extractJsonArray(rawText);
  if (!jsonArray) {
    return [];
  }

  try {
    const parsed = JSON.parse(jsonArray);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseCorrectLabel(value: unknown): string | null {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase();

  return OPTION_LABELS.includes(normalized as (typeof OPTION_LABELS)[number]) ? normalized : null;
}

function sanitizeAiQuestion(raw: unknown, fallbackTopic: string): ParsedAiQuestion | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const parsed = raw as {
    statement?: unknown;
    topic?: unknown;
    questionType?: unknown;
    options?: unknown;
    correctOption?: unknown;
    correctOptions?: unknown;
  };

  const statement = normalizeText(String(parsed.statement ?? ""));
  if (statement.length < 16) {
    return null;
  }

  const optionsRaw = Array.isArray(parsed.options) ? parsed.options : [];
  const optionsWithFlags = optionsRaw
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const typedItem = item as {
        content?: unknown;
        text?: unknown;
        explanation?: unknown;
        isCorrect?: unknown;
      };
      const content = normalizeOptionContent(String(typedItem.content ?? typedItem.text ?? ""));
      if (!content) {
        return null;
      }

      return {
        content,
        explanation: normalizeText(String(typedItem.explanation ?? "")) || null,
        isCorrect: Boolean(typedItem.isCorrect),
      };
    })
    .filter((item): item is ParsedAiOption => item !== null)
    .slice(0, 5);

  const dedupedOptions: ParsedAiOption[] = [];
  const seen = new Set<string>();
  for (const option of optionsWithFlags) {
    const key = option.content.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    dedupedOptions.push(option);
  }

  if (dedupedOptions.length < 4) {
    return null;
  }

  const explicitCorrectLabels = Array.isArray(parsed.correctOptions)
    ? parsed.correctOptions.map(parseCorrectLabel).filter((item): item is string => Boolean(item))
    : [];
  const explicitSingleCorrect = parseCorrectLabel(parsed.correctOption);

  if (explicitCorrectLabels.length > 0) {
    dedupedOptions.forEach((option, index) => {
      const label = OPTION_LABELS[index];
      option.isCorrect = explicitCorrectLabels.includes(label);
    });
  } else if (explicitSingleCorrect) {
    dedupedOptions.forEach((option, index) => {
      const label = OPTION_LABELS[index];
      option.isCorrect = label === explicitSingleCorrect;
    });
  }

  if (!dedupedOptions.some((item) => item.isCorrect)) {
    dedupedOptions[0].isCorrect = true;
  }

  const totalCorrect = dedupedOptions.filter((item) => item.isCorrect).length;
  let questionType: "single" | "multi" =
    parsed.questionType === "multi" || parsed.questionType === "single"
      ? parsed.questionType
      : totalCorrect > 1
        ? "multi"
        : "single";

  if (questionType === "single" && totalCorrect > 1) {
    let marked = false;
    dedupedOptions.forEach((option) => {
      if (option.isCorrect && !marked) {
        marked = true;
        return;
      }

      option.isCorrect = false;
    });
    questionType = "single";
  }

  const topic = normalizeText(String(parsed.topic ?? "")) || fallbackTopic;

  return {
    statement,
    topic,
    questionType,
    options: dedupedOptions,
  };
}

function buildUsageHash(question: ParsedAiQuestion): string {
  const canonical = [
    question.statement.toLowerCase(),
    question.topic.toLowerCase(),
    ...question.options.map((item) => `${item.content.toLowerCase()}:${item.isCorrect ? "1" : "0"}`),
  ].join("|");

  return createHash("sha256").update(canonical).digest("hex");
}

async function generateAndPersistFallbackQuestions(params: {
  certificationPresetId: string;
  certificationCode: string;
  certificationName: string;
  topicCodes: string[];
  difficulty: "easy" | "medium" | "hard" | "nightmare";
  neededCount: number;
}): Promise<{ generated: number; saved: number; error?: string }> {
  if (params.neededCount <= 0) {
    return { generated: 0, saved: 0 };
  }

  const existingServices = await prisma.awsService.findMany({
    where: { code: { in: params.topicCodes } },
    select: { id: true, code: true, name: true },
  });

  const services = [...existingServices];

  if (services.length === 0 && params.topicCodes.length > 0) {
    for (const code of params.topicCodes) {
      const upserted = await prisma.awsService.upsert({
        where: { code },
        update: { active: true, name: code },
        create: {
          code,
          name: code,
          active: true,
        },
        select: { id: true, code: true, name: true },
      });
      services.push(upserted);
    }
  }

  const fallbackTopic = services[0]?.name ?? params.topicCodes[0] ?? "GENERAL";
  const topicPrompt =
    services.length > 0
      ? services.map((item) => `${item.code} (${item.name})`).join(", ")
      : params.topicCodes.length > 0
        ? params.topicCodes.join(", ")
        : "GENERAL";

  const prompt = [
    "Voce e um gerador de questoes de certificacao AWS para treinamento.",
    `Gere EXATAMENTE ${params.neededCount} questoes em portugues brasileiro.`,
    `Certificacao alvo: ${params.certificationCode} - ${params.certificationName}.`,
    `Dificuldade obrigatoria: ${params.difficulty}.`,
    `Servicos/topicos obrigatorios: ${topicPrompt}.`,
    "Regras:",
    "- Retorne SOMENTE JSON valido.",
    '- Estrutura: { "questions": [ ... ] }',
    "- Cada questao precisa ter statement, topic, questionType e options.",
    "- options: minimo 4, maximo 5 itens.",
    "- Cada option precisa de content, explanation e isCorrect.",
    "- Em questionType=single, apenas uma correta.",
    "- Em questionType=multi, duas ou mais corretas.",
    "- Nao inclua markdown, comentarios ou texto fora do JSON.",
  ].join("\n");

  let raw = "";
  try {
    const model = getAiModel();
    const response = await model.generateContent(prompt);
    raw = response.response.text();
  } catch (error) {
    return {
      generated: 0,
      saved: 0,
      error: error instanceof Error ? error.message : "Falha na geracao por IA.",
    };
  }

  const aiPayload = parseAiPayload(raw);
  if (aiPayload.length === 0) {
    return {
      generated: 0,
      saved: 0,
      error: "A IA nao retornou um JSON valido de questoes.",
    };
  }

  const parsedQuestions = aiPayload
    .map((item) => sanitizeAiQuestion(item, fallbackTopic))
    .filter((item): item is ParsedAiQuestion => item !== null)
    .slice(0, params.neededCount);

  let saved = 0;
  for (let index = 0; index < parsedQuestions.length; index += 1) {
    const parsed = parsedQuestions[index];
    const usageHash = buildUsageHash(parsed);
    const assignedService = services.length > 0 ? services[index % services.length] : null;
    const correctLabels = parsed.options
      .map((option, optionIndex) => ({ option, label: OPTION_LABELS[optionIndex] }))
      .filter((item) => item.option.isCorrect)
      .map((item) => item.label);

    const primaryCorrect = correctLabels[0] ?? "A";
    const difficulty = params.difficulty as StudyQuestionDifficulty;

    try {
      const alreadyExists = await prisma.studyQuestion.findUnique({
        where: { usageHash },
        select: { id: true },
      });

      if (alreadyExists) {
        continue;
      }

      await prisma.studyQuestion.create({
        data: {
          externalId: `KC-AI-${params.certificationCode}-${randomUUID()}`,
          statement: parsed.statement,
          usage: StudyQuestionUsage.KC,
          difficulty,
          questionType: parsed.questionType,
          topic: assignedService?.name ?? parsed.topic,
          optionA: parsed.options[0]?.content ?? "",
          optionB: parsed.options[1]?.content ?? "",
          optionC: parsed.options[2]?.content ?? "",
          optionD: parsed.options[3]?.content ?? "",
          optionE: parsed.options[4]?.content ?? null,
          correctOption: primaryCorrect,
          correctOptions: correctLabels,
          explanationA: parsed.options[0]?.explanation ?? null,
          explanationB: parsed.options[1]?.explanation ?? null,
          explanationC: parsed.options[2]?.explanation ?? null,
          explanationD: parsed.options[3]?.explanation ?? null,
          explanationE: parsed.options[4]?.explanation ?? null,
          rawText: "AI_GENERATED_KC_FALLBACK",
          ingestionVersion: 2,
          usageHash,
          active: true,
          certificationPresetId: params.certificationPresetId,
          awsServiceId: assignedService?.id ?? null,
          questionOptions: {
            create: parsed.options.map((option, optionIndex) => ({
              content: option.content,
              isCorrect: option.isCorrect,
              order: optionIndex,
              explanation: option.explanation,
            })),
          },
          questionAwsServices: assignedService
            ? {
                create: {
                  serviceId: assignedService.id,
                },
              }
            : undefined,
        },
        select: { id: true },
      });

      saved += 1;
    } catch {
      // Skip invalid rows and continue with the next generated question.
    }
  }

  return {
    generated: parsedQuestions.length,
    saved,
    ...(saved === 0 ? { error: "Nenhuma questao gerada pela IA passou na validacao interna." } : {}),
  };
}

// Returns the set of service codes identified as gaps in the user's latest WeakAreaReport.
// A gap is defined as correctRate < 60% with enough attempts (as computed by the worker).
async function fetchGapServiceCodes(certificationPresetId: string): Promise<Set<string>> {
  const report = await prisma.weakAreaReport.findFirst({
    where: { certificationPresetId },
    orderBy: { analyzedAt: "desc" },
    select: { weakAreas: true },
  });

  if (!report) return new Set();

  const entries = report.weakAreas as WeakAreaEntry[];
  if (!Array.isArray(entries)) return new Set();

  return new Set(
    entries
      .filter((e) => e.dimension === "service" && e.correctRate < 0.6)
      .map((e) => e.dimensionId.toUpperCase()),
  );
}

// Builds a Prisma where clause with difficulty scaled per topic:
// - Gap services  → hard / nightmare (close the knowledge gap)
// - Other services → hard / medium  (challenging but not punishing)
// When no topics are selected, falls back to a mixed hard/medium distribution.
function buildDifficultyAwareWhere(
  topics: string[],
  gapCodes: Set<string>,
  baseWhere: Prisma.StudyQuestionWhereInput,
): Prisma.StudyQuestionWhereInput {
  if (topics.length === 0) {
    return { ...baseWhere, difficulty: { in: ["hard", "medium"] } };
  }

  const gapTopics = topics.filter((t) => gapCodes.has(t.toUpperCase()));
  const normalTopics = topics.filter((t) => !gapCodes.has(t.toUpperCase()));

  const serviceFilter = (codes: string[]): Prisma.StudyQuestionWhereInput => ({
    OR: [
      { awsService: { code: { in: codes } } },
      { questionAwsServices: { some: { service: { code: { in: codes } } } } },
    ],
  });

  const orClauses: Prisma.StudyQuestionWhereInput[] = [];

  if (gapTopics.length > 0) {
    orClauses.push({ difficulty: { in: ["hard", "nightmare"] }, ...serviceFilter(gapTopics) });
  }

  if (normalTopics.length > 0) {
    orClauses.push({ difficulty: { in: ["hard", "medium"] }, ...serviceFilter(normalTopics) });
  }

  // Strip the top-level service OR that baseWhere might already carry;
  // per-clause service filters above replace it.
  const { OR: _unused, ...baseWithoutServiceFilter } = baseWhere as { OR?: unknown } & Prisma.StudyQuestionWhereInput;

  return { ...baseWithoutServiceFilter, OR: orClauses };
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as Body;
  const topics = (body.topics ?? []).map((topic) => topic.trim()).filter(Boolean);
  const count = Math.max(5, Math.min(30, Number(body.count ?? 10)));
  const maxTopics = Math.max(1, Math.floor(count / 5));

  if (topics.length > maxTopics) {
    return NextResponse.json(
      { error: `Com ${count} questoes, selecione no maximo ${maxTopics} servicos.` },
      { status: 400 },
    );
  }

  const profile = await prisma.userProfile.findUnique({
    where: { userId: session.user.id },
    select: {
      certificationPresetId: true,
      certificationPreset: { select: { id: true, code: true, name: true } },
    },
  });

  if (!profile?.certificationPresetId || !profile.certificationPreset?.code) {
    return NextResponse.json(
      { error: "Defina sua certificacao alvo no perfil antes de iniciar um KC." },
      { status: 400 },
    );
  }

  // Identify gap services to scale difficulty (Issue #17).
  const gapCodes = await fetchGapServiceCodes(profile.certificationPresetId);

  const baseWhere: Prisma.StudyQuestionWhereInput = {
    active: true,
    certificationPresetId: profile.certificationPresetId,
    usage: { in: ["KC", "BOTH"] as Array<"KC" | "BOTH"> },
  };

  const difficultyAwareWhere = buildDifficultyAwareWhere(topics, gapCodes, baseWhere);

  const questionInclude = {
    certificationPreset: { select: { code: true } },
    awsService: { select: { code: true, name: true } },
    questionOptions: {
      select: { order: true, content: true, isCorrect: true, explanation: true },
      orderBy: { order: "asc" },
    },
    questionAwsServices: {
      select: { service: { select: { code: true, name: true } } },
    },
  } satisfies Prisma.StudyQuestionInclude;

  const questions = await prisma.studyQuestion.findMany({
    where: difficultyAwareWhere,
    include: questionInclude,
    take: 200,
  });

  let questionPool = questions;
  let generationRequestId: string | null = null;
  let aiFallbackMeta: { generated: number; saved: number; error?: string } | null = null;

  const gap = count - questionPool.length;

  // Fallback difficulty for generated questions: match the gap-aware selection above.
  const hasGapTopic = topics.some((t) => gapCodes.has(t.toUpperCase()));
  const fallbackDifficulty = hasGapTopic ? "hard" : "medium";

  if (gap > 0) {
    if (gap <= 2) {
      // Small gap (≤2): inline generation is fast enough; keep existing path.
      aiFallbackMeta = await generateAndPersistFallbackQuestions({
        certificationPresetId: profile.certificationPresetId,
        certificationCode: profile.certificationPreset.code,
        certificationName: profile.certificationPreset.name,
        topicCodes: topics,
        difficulty: fallbackDifficulty,
        neededCount: gap,
      });

      questionPool = await prisma.studyQuestion.findMany({
        where: difficultyAwareWhere,
        include: questionInclude,
        take: 200,
      });
    } else {
      // Large gap (>2): enqueue background generation via WorkerTrigger (ADR-03, CA-08).
      // Worker adds to kcGenerationQueue with priority 1 — user-facing, runs ahead of
      // scheduled background jobs (ADR-KC-02). Client polls generate-status to backfill.
      generationRequestId = randomBytes(16).toString("hex");

      await prisma.workerTrigger.create({
        data: {
          action: "generate-kc",
          source: "kc_gap_fill",
          payload: {
            requestId: generationRequestId,
            userId: session.user.id,
            serviceCode: topics[0] ?? null,
            topic: topics[0] ? null : "AWS General",
            difficulty: fallbackDifficulty,
            count: gap,
          },
        },
      });
    }
  }

  if (questionPool.length === 0) {
    return NextResponse.json(
      {
        error:
          aiFallbackMeta?.error ??
          "Nenhuma questao encontrada. Geracao em andamento — tente novamente em instantes.",
        generationRequestId,
      },
      { status: 404 },
    );
  }

  const selected = pickRandomItems(questionPool, Math.min(count, questionPool.length)).map(mapDbQuestionToStudyQuestion);
  return NextResponse.json({
    questions: selected,
    generationRequestId, // non-null when background generation was enqueued
    aiFallback: aiFallbackMeta,
    insufficient: generationRequestId !== null, // pool had fewer questions than requested
  });
}
