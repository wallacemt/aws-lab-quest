import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

function parseLimit(raw: string | null): number {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return 20;
  }

  return Math.max(1, Math.min(100, Math.round(value)));
}

export async function GET(request: NextRequest) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  const limit = parseLimit(request.nextUrl.searchParams.get("limit"));

  const files = await prisma.adminUploadedFile.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
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
  });

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

  return NextResponse.json({ files, recentJobs });
}
