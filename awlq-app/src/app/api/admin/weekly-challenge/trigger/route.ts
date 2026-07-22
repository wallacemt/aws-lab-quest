import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

type TriggerBody = { mode?: "open" | "close" };

/**
 * POST /api/admin/weekly-challenge/trigger { mode: "open" | "close" }
 * Manually runs weekly-challenge.worker's open/close routine out of cron schedule
 * (e.g. to close+rank early, or reopen after fixing a misconfigured challenge).
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  let body: TriggerBody;
  try {
    body = (await request.json()) as TriggerBody;
  } catch {
    return NextResponse.json({ error: "Corpo JSON invalido." }, { status: 400 });
  }

  if (body.mode !== "open" && body.mode !== "close") {
    return NextResponse.json({ error: "'mode' deve ser 'open' ou 'close'." }, { status: 400 });
  }

  await prisma.workerTrigger.create({
    data: {
      action: "weekly-challenge-force",
      source: "manual",
      payload: { mode: body.mode },
    },
  });

  return NextResponse.json({ ok: true });
}
