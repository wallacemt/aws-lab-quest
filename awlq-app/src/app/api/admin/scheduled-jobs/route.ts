import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

const ALLOWED_QUEUES = [
  "source-fetch",
  "question-generation",
  "feedback-analysis",
  "performance-compute",
  "email-send",
] as const;

function isValidCron(pattern: string): boolean {
  // Basic 5-field cron validation
  const parts = pattern.trim().split(/\s+/);
  return parts.length === 5;
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if (!authResult.ok) return authResult.response;

    const jobs = await prisma.scheduledJob.findMany({
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ jobs });
  } catch (error) {
    console.error("GET /api/admin/scheduled-jobs error:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if (!authResult.ok) return authResult.response;

    const body = (await request.json()) as {
      jobId?: string;
      name?: string;
      description?: string;
      queue?: string;
      cronPattern?: string;
      payload?: unknown;
    };

    if (!body.jobId || !body.name || !body.queue || !body.cronPattern) {
      return NextResponse.json({ error: "jobId, name, queue e cronPattern sao obrigatorios" }, { status: 400 });
    }

    if (!ALLOWED_QUEUES.includes(body.queue as (typeof ALLOWED_QUEUES)[number])) {
      return NextResponse.json({ error: `Fila invalida. Opcoes: ${ALLOWED_QUEUES.join(", ")}` }, { status: 400 });
    }

    if (!isValidCron(body.cronPattern)) {
      return NextResponse.json({ error: "Expressao cron invalida (5 campos esperados)" }, { status: 400 });
    }

    const job = await prisma.scheduledJob.create({
      data: {
        jobId: body.jobId,
        name: body.name,
        description: body.description,
        queue: body.queue,
        cronPattern: body.cronPattern,
        payload: body.payload ?? undefined,
        active: true,
      },
    });

    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/scheduled-jobs error:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
