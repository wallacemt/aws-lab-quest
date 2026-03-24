import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

function parseLimit(raw: string | null): number {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return 20;
  }

  return Math.max(1, Math.min(100, Math.round(value)));
}

function parsePage(raw: string | null): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 1) {
    return 1;
  }

  return Math.floor(value);
}

export async function GET(request: NextRequest) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  const limit = parseLimit(request.nextUrl.searchParams.get("limit"));
  const page = parsePage(request.nextUrl.searchParams.get("page"));
  const pageSize = Math.min(50, parseLimit(request.nextUrl.searchParams.get("pageSize")));
  const search = request.nextUrl.searchParams.get("search")?.trim() ?? "";
  const uploadType = request.nextUrl.searchParams.get("uploadType")?.trim() ?? "";
  const certificationCode = request.nextUrl.searchParams.get("certificationCode")?.trim() ?? "";

  const where: Prisma.AdminUploadedFileWhereInput = {};

  if (search) {
    where.OR = [
      { fileName: { contains: search, mode: "insensitive" } },
      { storagePath: { contains: search, mode: "insensitive" } },
      { sha256: { contains: search, mode: "insensitive" } },
      { certificationPreset: { is: { code: { contains: search, mode: "insensitive" } } } },
    ];
  }

  if (uploadType === "EXAM_GUIDE" || uploadType === "SIMULADO_PDF" || uploadType === "SIMULADO_GENERATION") {
    where.uploadType = uploadType;
  }

  if (certificationCode) {
    where.certificationPreset = {
      is: {
        code: certificationCode,
      },
    };
  }

  const [files, total] = await Promise.all([
    prisma.adminUploadedFile.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        uploadType: true,
        fileName: true,
        mimeType: true,
        fileSizeBytes: true,
        storageBucket: true,
        storagePath: true,
        sha256: true,
        source: true,
        createdAt: true,
        certificationPreset: {
          select: {
            code: true,
            name: true,
          },
        },
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
    prisma.adminUploadedFile.count({ where }),
  ]);

  const recentJobs = await prisma.adminIngestionJob.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      status: true,
      uploadType: true,
      progressPercent: true,
      message: true,
      generatedCount: true,
      savedCount: true,
      errorMessage: true,
      fileName: true,
      createdAt: true,
      updatedAt: true,
      finishedAt: true,
      certificationPreset: {
        select: {
          code: true,
          name: true,
        },
      },
      uploadedFile: {
        select: {
          id: true,
          fileName: true,
        },
      },
    },
  });

  return NextResponse.json({
    files,
    filesPagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
    recentJobs,
    recentJobsLimit: limit,
  });
}
