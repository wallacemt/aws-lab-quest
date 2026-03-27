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

export async function PATCH(request: NextRequest, context: RouteContext) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  const { jobId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { action?: string };

  if (body.action !== "cancel") {
    return NextResponse.json({ error: "Acao invalida." }, { status: 400 });
  }

  const current = await prisma.adminIngestionJob.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      status: true,
    },
  });

  if (!current) {
    return NextResponse.json({ error: "Job nao encontrado." }, { status: 404 });
  }

  if (current.status === "COMPLETED" || current.status === "FAILED") {
    return NextResponse.json({
      cancelled: false,
      message: "Job ja finalizado.",
      status: current.status,
    });
  }

  const cancelled = await prisma.adminIngestionJob.update({
    where: { id: jobId },
    data: {
      status: "FAILED",
      progressPercent: 100,
      message: "Processamento cancelado manualmente pelo admin.",
      errorMessage: "CANCELLED_BY_ADMIN",
      finishedAt: new Date(),
    },
    select: {
      id: true,
      status: true,
      message: true,
      errorMessage: true,
    },
  });

  return NextResponse.json({ cancelled: true, job: cancelled });
}
