import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

function parsePageParam(value: string | null, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.floor(parsed);
}

export async function GET(request: NextRequest) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  const page = parsePageParam(request.nextUrl.searchParams.get("page"), 1);
  const pageSize = Math.min(50, parsePageParam(request.nextUrl.searchParams.get("pageSize"), 10));
  const search = request.nextUrl.searchParams.get("search")?.trim() ?? "";

  const where = search
    ? {
        OR: [
          { statement: { contains: search, mode: "insensitive" as const } },
          { topic: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

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
        usage: true,
        active: true,
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
