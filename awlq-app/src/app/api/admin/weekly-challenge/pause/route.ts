import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

// Pausing only disables the Monday-opening cron (cron-weekly-challenge-open).
// The Sunday-close cron keeps running, so a challenge already in progress
// finishes and gets ranked normally — pausing/resuming only ever takes effect
// on the *next* Monday, whatever day of the week the admin toggles it.
export const OPEN_CRON_JOB_ID = "cron-weekly-challenge-open";

interface PauseBody {
  paused?: boolean;
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  let body: PauseBody;
  try {
    body = (await request.json()) as PauseBody;
  } catch {
    return NextResponse.json({ error: "Corpo JSON invalido." }, { status: 400 });
  }

  if (typeof body.paused !== "boolean") {
    return NextResponse.json({ error: "'paused' (boolean) e obrigatorio." }, { status: 400 });
  }

  const job = await prisma.scheduledJob.upsert({
    where: { jobId: OPEN_CRON_JOB_ID },
    update: { active: !body.paused },
    create: {
      jobId: OPEN_CRON_JOB_ID,
      name: "Desafio Semanal — Abrir (Segunda-feira)",
      description: "Abre novo desafio semanal toda segunda-feira a 00:00 UTC",
      queue: "weekly-challenge",
      cronPattern: "0 0 * * 1",
      payload: { mode: "open" },
      active: !body.paused,
    },
  });

  return NextResponse.json({ paused: !job.active });
}
