import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    questionId: string;
  }>;
};

type ReportStatus = "OPEN" | "IN_REVIEW" | "RESOLVED" | "DISMISSED";

function parsePageParam(value: string | null, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.floor(parsed);
}

function parseStatus(value: string | null): ReportStatus | undefined {
  const normalized = value?.trim().toUpperCase();
  if (normalized === "OPEN" || normalized === "IN_REVIEW" || normalized === "RESOLVED" || normalized === "DISMISSED") {
    return normalized;
  }

  return undefined;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  const { questionId } = await context.params;
  const page = parsePageParam(request.nextUrl.searchParams.get("page"), 1);
  const pageSize = Math.min(50, parsePageParam(request.nextUrl.searchParams.get("pageSize"), 5));
  const status = parseStatus(request.nextUrl.searchParams.get("status"));

  const question = await prisma.studyQuestion.findUnique({
    where: { id: questionId },
    select: { id: true },
  });

  if (!question) {
    return NextResponse.json({ error: "Questao nao encontrada." }, { status: 404 });
  }

  const where = {
    questionId,
    ...(status ? { status } : {}),
  };

  const [reports, total] = await Promise.all([
    prisma.questionReport.findMany({
      where,
      orderBy: [{ reportedAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        reason: true,
        status: true,
        description: true,
        reportedAt: true,
        reviewedAt: true,
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true,
            profile: {
              select: {
                avatarUrl: true,
              },
            },
          },
        },
      },
    }),
    prisma.questionReport.count({ where }),
  ]);

  const items = reports.map((report) => ({
    id: report.id,
    reason: report.reason,
    status: report.status,
    description: report.description,
    reportedAt: report.reportedAt,
    reviewedAt: report.reviewedAt,
    reporter: {
      id: report.user.id,
      name: report.user.name,
      username: report.user.username,
      imageUrl: report.user.profile?.avatarUrl ?? report.user.image ?? null,
    },
  }));

  return NextResponse.json({
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}
