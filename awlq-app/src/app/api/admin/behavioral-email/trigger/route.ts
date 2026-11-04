import { NextRequest, NextResponse } from "next/server";
import { withAdminAudit } from "@/features/audit/server/with-admin-audit";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const POST = withAdminAudit("behavioral-email/trigger", async (request: NextRequest) => {
  const authResult = await requireAdmin(request);
  if (!authResult.ok) return authResult.response;

  await prisma.workerTrigger.create({
    data: {
      action: "behavioral-email-analysis",
      source: "manual",
    },
  });

  return NextResponse.json({ ok: true });
});
