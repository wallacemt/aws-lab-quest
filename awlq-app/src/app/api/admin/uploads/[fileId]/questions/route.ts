import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    fileId: string;
  }>;
};

function parsePage(raw: string | null): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 1) {
    return 1;
  }

  return Math.floor(value);
}

function parsePageSize(raw: string | null): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 1) {
    return 10;
  }

  return Math.max(1, Math.min(50, Math.floor(value)));
}

export async function GET(request: NextRequest, context: RouteContext) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  const { fileId } = await context.params;
  const page = parsePage(request.nextUrl.searchParams.get("page"));
  const pageSize = parsePageSize(request.nextUrl.searchParams.get("pageSize"));

  const uploadedFile = await prisma.adminUploadedFile.findUnique({
    where: { id: fileId },
    select: {
      id: true,
      fileName: true,
      uploadType: true,
      certificationPreset: {
        select: {
          code: true,
          name: true,
        },
      },
    },
  });

  if (!uploadedFile) {
    return NextResponse.json({ error: "Arquivo nao encontrado." }, { status: 404 });
  }

  const where = {
    sourceUploadedFileId: fileId,
  };

  const [items, total] = await Promise.all([
    prisma.studyQuestion.findMany({
      where,
      orderBy: { createdAt: "desc" },
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
        correctOption: true,
        correctOptions: true,
        questionOptions: {
          select: {
            order: true,
            isCorrect: true,
          },
          orderBy: {
            order: "asc",
          },
        },
        createdAt: true,
      },
    }),
    prisma.studyQuestion.count({ where }),
  ]);

  const labels = ["A", "B", "C", "D", "E"] as const;
  const normalizedItems = items.map((item) => {
    const normalizedCorrectOptions = [...(item.questionOptions ?? [])]
      .slice(0, 5)
      .map((option, index) => ({ option, label: labels[index] }))
      .filter((entry): entry is { option: { order: number; isCorrect: boolean }; label: "A" | "B" | "C" | "D" | "E" } =>
        Boolean(entry.label),
      )
      .filter((entry) => entry.option.isCorrect)
      .map((entry) => entry.label);

    const legacyCorrectOptions = Array.isArray(item.correctOptions)
      ? item.correctOptions.filter((value): value is string => typeof value === "string")
      : [];

    const correctOptions =
      normalizedCorrectOptions.length > 0
        ? normalizedCorrectOptions
        : legacyCorrectOptions.length > 0
          ? legacyCorrectOptions
          : [item.correctOption];

    return {
      id: item.id,
      externalId: item.externalId,
      statement: item.statement,
      topic: item.topic,
      difficulty: item.difficulty,
      questionType: item.questionType,
      usage: item.usage,
      createdAt: item.createdAt,
      correctOption: correctOptions[0] ?? item.correctOption,
      correctOptions,
    };
  });

  return NextResponse.json({
    uploadedFile,
    items: normalizedItems,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}
