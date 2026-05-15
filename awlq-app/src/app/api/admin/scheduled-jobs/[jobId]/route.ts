import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

function isValidCron(pattern: string): boolean {
  const parts = pattern.trim().split(/\s+/);
  return parts.length === 5;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const authResult = await requireAdmin(request);
    if (!authResult.ok) return authResult.response;

    const { jobId } = await params;

    const body = (await request.json()) as {
      active?: boolean;
      cronPattern?: string;
      name?: string;
      description?: string;
    };

    if (body.cronPattern !== undefined && !isValidCron(body.cronPattern)) {
      return NextResponse.json({ error: "Expressao cron invalida (5 campos esperados)" }, { status: 400 });
    }

    const existing = await prisma.scheduledJob.findUnique({ where: { jobId } });
    if (!existing) {
      return NextResponse.json({ error: "Job nao encontrado" }, { status: 404 });
    }

    const updated = await prisma.scheduledJob.update({
      where: { jobId },
      data: {
        ...(typeof body.active === "boolean" ? { active: body.active } : {}),
        ...(body.cronPattern !== undefined ? { cronPattern: body.cronPattern } : {}),
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
      },
    });

    return NextResponse.json({ job: updated });
  } catch (error) {
    console.error("PATCH /api/admin/scheduled-jobs/[jobId] error:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
