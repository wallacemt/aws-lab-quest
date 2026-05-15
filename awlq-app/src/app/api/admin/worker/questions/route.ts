import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

function parsePageParam(value: string | null, fallback: number): number {
  const n = parseInt(value ?? "", 10);
  return isNaN(n) || n < 1 ? fallback : n;
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if (!authResult.ok) return authResult.response;

    const page = parsePageParam(request.nextUrl.searchParams.get("page"), 1);
    const pageSize = Math.min(50, parsePageParam(request.nextUrl.searchParams.get("pageSize"), 20));
    const certificationId = request.nextUrl.searchParams.get("certificationId") || undefined;
    const dateFrom = request.nextUrl.searchParams.get("dateFrom");
    const dateTo = request.nextUrl.searchParams.get("dateTo");

    const where = {
      sourceUploadedFileId: null as null,
      ...(certificationId ? { certificationPresetId: certificationId } : {}),
      ...(dateFrom || dateTo
        ? {
            createdAt: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo ? { lte: new Date(dateTo) } : {}),
            },
          }
        : {}),
    };

    const [rawItems, total] = await Promise.all([
      prisma.studyQuestion.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          statement: true,
          topic: true,
          difficulty: true,
          questionType: true,
          createdAt: true,
          certificationPreset: { select: { code: true, name: true } },
          questionAwsServices: {
            select: { service: { select: { name: true, code: true } } },
          },
        },
      }),
      prisma.studyQuestion.count({ where }),
    ]);

    const items = rawItems.map((q) => ({
      ...q,
      statement: q.statement.length > 120 ? q.statement.slice(0, 120) + "..." : q.statement,
      awsServices: q.questionAwsServices.map((r) => r.service.code),
      questionAwsServices: undefined,
    }));

    return NextResponse.json({
      items,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (error) {
    console.error("GET /api/admin/worker/questions error:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
