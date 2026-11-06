import { NextRequest, NextResponse } from "next/server";
import { withAdminAudit } from "@/features/audit/server/with-admin-audit";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

interface TriggerBody {
  mode?: "open" | "close";
}

export const POST = withAdminAudit("weekly-challenge/trigger", async (request: NextRequest) => {
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
    data: { action: "weekly-challenge-force", source: "manual", payload: { mode: body.mode } },
  });

  return NextResponse.json({ ok: true });
});
