import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

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
    where.certificationPreset = {
      code: certificationCode,
    };
  }

  if (awsServiceCode) {
    where.awsService = {
      code: awsServiceCode,
    };
  }

  const orderBy: Prisma.StudyQuestionOrderByWithRelationInput = { [sortBy]: sortOrder };

  const [items, total] = await Promise.all([
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
      },
    }),
    prisma.studyQuestion.count({ where }),
  ]);

  return NextResponse.json({
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}
