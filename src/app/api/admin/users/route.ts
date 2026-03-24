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

function parseDateParam(value: string | null): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function parseSortOrder(value: string | null): Prisma.SortOrder {
  return value === "asc" ? "asc" : "desc";
}

function parseSortBy(value: string | null): "createdAt" | "lastSeen" | "name" | "email" | "role" {
  if (value === "lastSeen" || value === "name" || value === "email" || value === "role") {
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
  const pageSize = Math.min(50, parsePageParam(request.nextUrl.searchParams.get("pageSize"), 10));
  const search = request.nextUrl.searchParams.get("search")?.trim() ?? "";
  const role = request.nextUrl.searchParams.get("role")?.trim() ?? "";
  const certificationCode = request.nextUrl.searchParams.get("certificationCode")?.trim() ?? "";
  const createdFrom = parseDateParam(request.nextUrl.searchParams.get("createdFrom"));
  const createdTo = parseDateParam(request.nextUrl.searchParams.get("createdTo"));
  const lastSeenFrom = parseDateParam(request.nextUrl.searchParams.get("lastSeenFrom"));
  const lastSeenTo = parseDateParam(request.nextUrl.searchParams.get("lastSeenTo"));
  const sortBy = parseSortBy(request.nextUrl.searchParams.get("sortBy"));
  const sortOrder = parseSortOrder(request.nextUrl.searchParams.get("sortOrder"));

  const where: Prisma.UserWhereInput = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { username: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  if (role) {
    where.role = role;
  }

  if (certificationCode) {
    where.profile = {
      OR: [{ certificationPreset: { code: certificationCode } }, { certification: certificationCode }],
    };
  }

  if (createdFrom || createdTo) {
    where.createdAt = {
      ...(createdFrom ? { gte: createdFrom } : {}),
      ...(createdTo ? { lte: createdTo } : {}),
    };
  }

  if (lastSeenFrom || lastSeenTo) {
    where.lastSeen = {
      ...(lastSeenFrom ? { gte: lastSeenFrom } : {}),
      ...(lastSeenTo ? { lte: lastSeenTo } : {}),
    };
  }

  const orderBy: Prisma.UserOrderByWithRelationInput = { [sortBy]: sortOrder };

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        role: true,
        createdAt: true,
        lastSeen: true,
        profile: {
          select: {
            certification: true,
            certificationPreset: {
              select: {
                code: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: {
            questHistory: true,
            studyHistory: true,
          },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json({
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}
