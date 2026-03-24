import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    jobId: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  const { jobId } = await context.params;

  const job = await prisma.adminIngestionJob.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      status: true,
      uploadType: true,
      fileName: true,
      progressPercent: true,
      message: true,
      desiredCount: true,
      generatedCount: true,
      savedCount: true,
      errorMessage: true,
      startedAt: true,
      finishedAt: true,
      createdAt: true,
      updatedAt: true,
      uploadedFile: {
        select: {
          id: true,
          fileName: true,
          storageBucket: true,
          storagePath: true,
          fileSizeBytes: true,
        },
      },
      certificationPreset: {
        select: {
          code: true,
          name: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!job) {
    return NextResponse.json({ error: "Job nao encontrado." }, { status: 404 });
  }

  return NextResponse.json({ job });
}
