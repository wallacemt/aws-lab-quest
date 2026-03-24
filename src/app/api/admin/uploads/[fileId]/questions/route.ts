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
        usage: true,
        correctOption: true,
        createdAt: true,
      },
    }),
    prisma.studyQuestion.count({ where }),
  ]);

  return NextResponse.json({
    uploadedFile,
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}
