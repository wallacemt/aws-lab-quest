import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

type NormalizedOptionItem = {
  order: number;
  content: string;
  isCorrect: boolean;
  explanation: string | null;
};

type AdminQuestionListDbItem = {
  id: string;
  externalId: string;
  statement: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  questionType: "single" | "multi";
  usage: "KC" | "SIMULADO" | "BOTH";
  active: boolean;
  correctOption: string;
  correctOptions: string[] | null;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  optionE: string | null;
  explanationA: string | null;
  explanationB: string | null;
  explanationC: string | null;
  explanationD: string | null;
  explanationE: string | null;
  createdAt: Date;
  certificationPreset: {
    code: string;
    name: string;
  } | null;
  awsService: {
    code: string;
    name: string;
  } | null;
  questionOptions: NormalizedOptionItem[];
  questionAwsServices: Array<{
    service: {
      code: string;
      name: string;
    };
  }>;
};

const UNASSIGNED_SERVICE_FILTER = "__UNASSIGNED__";

function toAdminQuestionView(item: AdminQuestionListDbItem) {
  const orderedNormalized = [...(item.questionOptions ?? [])].sort((a, b) => a.order - b.order).slice(0, 5);
  const keyByIndex = ["A", "B", "C", "D", "E"] as const;
  const useNormalized = orderedNormalized.length >= 2;

  const optionA = useNormalized ? (orderedNormalized[0]?.content ?? item.optionA) : item.optionA;
  const optionB = useNormalized ? (orderedNormalized[1]?.content ?? item.optionB) : item.optionB;
  const optionC = useNormalized ? (orderedNormalized[2]?.content ?? item.optionC) : item.optionC;
  const optionD = useNormalized ? (orderedNormalized[3]?.content ?? item.optionD) : item.optionD;
  const optionE = useNormalized ? (orderedNormalized[4]?.content ?? null) : item.optionE;

  const explanationA = useNormalized ? (orderedNormalized[0]?.explanation ?? item.explanationA) : item.explanationA;
  const explanationB = useNormalized ? (orderedNormalized[1]?.explanation ?? item.explanationB) : item.explanationB;
  const explanationC = useNormalized ? (orderedNormalized[2]?.explanation ?? item.explanationC) : item.explanationC;
  const explanationD = useNormalized ? (orderedNormalized[3]?.explanation ?? item.explanationD) : item.explanationD;
  const explanationE = useNormalized ? (orderedNormalized[4]?.explanation ?? item.explanationE) : item.explanationE;

  const normalizedCorrectOptions = useNormalized
    ? orderedNormalized
        .map((option, index) => ({ option, key: keyByIndex[index] }))
        .filter((entry): entry is { option: NormalizedOptionItem; key: "A" | "B" | "C" | "D" | "E" } =>
          Boolean(entry.key),
        )
        .filter((entry) => entry.option.isCorrect)
        .map((entry) => entry.key)
    : [];

  const correctOptions =
    normalizedCorrectOptions.length > 0
      ? normalizedCorrectOptions
      : Array.isArray(item.correctOptions) && item.correctOptions.length > 0
        ? item.correctOptions
        : [item.correctOption];
  const correctOption = correctOptions[0] ?? item.correctOption;

  const options = ["A", "B", "C", "D", "E"].map((label) => {
    const index = label.charCodeAt(0) - 65;
    const content =
      label === "A" ? optionA : label === "B" ? optionB : label === "C" ? optionC : label === "D" ? optionD : optionE;
    const explanation =
      label === "A"
        ? explanationA
        : label === "B"
          ? explanationB
          : label === "C"
            ? explanationC
            : label === "D"
              ? explanationD
              : explanationE;

    return {
      label,
      content,
      explanation,
      isCorrect: correctOptions.includes(label),
      order: index,
    };
  });

  const normalizedServices = item.questionAwsServices?.map((entry) => entry.service) ?? [];
  const allServices = [...normalizedServices, ...(item.awsService ? [item.awsService] : [])].filter(
    (service, index, array) => array.findIndex((candidate) => candidate.code === service.code) === index,
  );
  const primaryService = allServices[0] ?? null;

  return {
    id: item.id,
    externalId: item.externalId,
    statement: item.statement,
    topic: primaryService?.name ?? item.topic,
    difficulty: item.difficulty,
    questionType: item.questionType,
    usage: item.usage,
    active: item.active,
    correctOption,
    correctOptions,
    optionA,
    optionB,
    optionC,
    optionD,
    optionE,
    explanationA,
    explanationB,
    explanationC,
    explanationD,
    explanationE,
    options,
    createdAt: item.createdAt,
    certificationPreset: item.certificationPreset,
    awsService: primaryService,
    awsServices: allServices,
  };
}

function parsePageParam(value: string | null, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.floor(parsed);
}

function parseSortOrder(value: string | null): Prisma.SortOrder {
  return value === "asc" ? "asc" : "desc";
}

function parseSortBy(
  value: string | null,
): "createdAt" | "difficulty" | "usage" | "topic" | "externalId" | "active" | "questionType" {
  if (
    value === "difficulty" ||
    value === "usage" ||
    value === "topic" ||
    value === "externalId" ||
    value === "active" ||
    value === "questionType"
  ) {
    return value;
  }

  return "createdAt";
}

export async function GET(request: NextRequest) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  const page = parsePageParam(request.nextUrl.searchParams.get("page"), 1);
  const pageSize = Math.min(200, parsePageParam(request.nextUrl.searchParams.get("pageSize"), 10));
  const search = request.nextUrl.searchParams.get("search")?.trim() ?? "";
  const difficulty = request.nextUrl.searchParams.get("difficulty")?.trim() ?? "";
  const questionType = request.nextUrl.searchParams.get("questionType")?.trim() ?? "";
  const usage = request.nextUrl.searchParams.get("usage")?.trim() ?? "";
  const activeParam = request.nextUrl.searchParams.get("active")?.trim() ?? "";
  const certificationCode = request.nextUrl.searchParams.get("certificationCode")?.trim() ?? "";
  const awsServiceCode = request.nextUrl.searchParams.get("awsServiceCode")?.trim() ?? "";
  const sortBy = parseSortBy(request.nextUrl.searchParams.get("sortBy"));
  const sortOrder = parseSortOrder(request.nextUrl.searchParams.get("sortOrder"));

  const where: Prisma.StudyQuestionWhereInput = {};
  const andFilters: Prisma.StudyQuestionWhereInput[] = [];

  if (search) {
    where.OR = [
      { statement: { contains: search, mode: "insensitive" } },
      { topic: { contains: search, mode: "insensitive" } },
      { externalId: { contains: search, mode: "insensitive" } },
    ];
  }

  if (difficulty === "easy" || difficulty === "medium" || difficulty === "hard") {
    where.difficulty = difficulty;
  }

  if (questionType === "single" || questionType === "multi") {
    where.questionType = questionType;
  }

  if (usage === "KC" || usage === "SIMULADO" || usage === "BOTH") {
    where.usage = usage;
  }

  if (activeParam === "true" || activeParam === "false") {
    where.active = activeParam === "true";
  }

  if (certificationCode) {
    andFilters.push({
      certificationPreset: {
        code: certificationCode,
      },
    });
  }

  if (awsServiceCode) {
    if (awsServiceCode === UNASSIGNED_SERVICE_FILTER) {
      andFilters.push({
        AND: [{ awsService: null }, { questionAwsServices: { none: {} } }],
      });
    } else {
      andFilters.push({
        OR: [
          { awsService: { code: awsServiceCode } },
          { questionAwsServices: { some: { service: { code: awsServiceCode } } } },
        ],
      });
    }
  }

  if (andFilters.length > 0) {
    where.AND = andFilters;
  }

  const orderBy: Prisma.StudyQuestionOrderByWithRelationInput = { [sortBy]: sortOrder };

  const [rawItems, total] = await Promise.all([
    prisma.studyQuestion.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        externalId: true,
        statement: true,
        topic: true,
        difficulty: true,
        questionType: true,
        usage: true,
        active: true,
        correctOption: true,
        correctOptions: true,
        optionA: true,
        optionB: true,
        optionC: true,
        optionD: true,
        optionE: true,
        explanationA: true,
        explanationB: true,
        explanationC: true,
        explanationD: true,
        explanationE: true,
        createdAt: true,
        certificationPreset: {
          select: {
            code: true,
            name: true,
          },
        },
        awsService: {
          select: {
            code: true,
            name: true,
          },
        },
        questionOptions: {
          select: {
            order: true,
            content: true,
            isCorrect: true,
            explanation: true,
          },
          orderBy: {
            order: "asc",
          },
        },
        questionAwsServices: {
          select: {
            service: {
              select: {
                code: true,
                name: true,
              },
            },
          },
        },
      },
    }),
    prisma.studyQuestion.count({ where }),
  ]);

  const items = (rawItems as AdminQuestionListDbItem[]).map(toAdminQuestionView);

  return NextResponse.json({
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}
