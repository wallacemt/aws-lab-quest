import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    questionId: string;
    reportId: string;
  }>;
};

type Body = {
  status?: string;
  reviewNotes?: string;
};

function normalizeStatus(value: unknown): "RESOLVED" | "DISMISSED" | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  if (normalized === "RESOLVED" || normalized === "DISMISSED") {
    return normalized;
  }

  return null;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  const { questionId, reportId } = await context.params;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Payload invalido." }, { status: 400 });
  }

  const status = normalizeStatus(body.status);
  if (!status) {
    return NextResponse.json({ error: "Status invalido. Use RESOLVED ou DISMISSED." }, { status: 400 });
  }

  const reviewNotes = typeof body.reviewNotes === "string" ? body.reviewNotes.trim().slice(0, 1000) : "";

  const report = await prisma.questionReport.findFirst({
    where: {
      id: reportId,
      questionId,
    },
    select: {
      id: true,
      questionId: true,
    },
  });

  if (!report) {
    return NextResponse.json({ error: "Denuncia nao encontrada para esta questao." }, { status: 404 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updatedReport = await tx.questionReport.update({
      where: { id: reportId },
      data: {
        status,
        reviewedByUserId: adminCheck.userId,
        reviewedAt: new Date(),
        reviewNotes: reviewNotes.length > 0 ? reviewNotes : null,
      },
      select: {
        id: true,
        status: true,
        reviewedAt: true,
        reviewNotes: true,
      },
    });

    const [reportCount, openReportCount] = await Promise.all([
      tx.questionReport.count({ where: { questionId } }),
      tx.questionReport.count({ where: { questionId, status: "OPEN" } }),
    ]);

    if (openReportCount === 0) {
      await tx.studyQuestion.update({
        where: { id: questionId },
        data: {
          flaggedAt: null,
          flaggedReason: null,
        },
      });
    }

    return {
      report: updatedReport,
      question: {
        id: questionId,
        reportCount,
        openReportCount,
      },
    };
  });

  return NextResponse.json(updated);
}
