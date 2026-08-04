import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { devAuditLog } from "@/lib/dev-audit";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ triggerId: string }>;
};

export async function DELETE(request: NextRequest, context: RouteContext) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  const { triggerId } = await context.params;

  const current = await prisma.workerTrigger.findUnique({ where: { id: triggerId } });
  if (!current || current.action !== "email-send" || !current.scheduledFor) {
    return NextResponse.json({ error: "Envio agendado nao encontrado." }, { status: 404 });
  }

  if (current.processed) {
    return NextResponse.json({ error: "Este envio ja foi processado e nao pode mais ser cancelado." }, { status: 400 });
  }

  // deleteMany + processed:false guards against a race with the worker's
  // trigger-poller, which polls every 30s and could process this trigger
  // between the check above and this delete.
  const deleted = await prisma.workerTrigger.deleteMany({ where: { id: triggerId, processed: false } });
  if (deleted.count === 0) {
    return NextResponse.json({ error: "Este envio ja foi processado e nao pode mais ser cancelado." }, { status: 400 });
  }

  devAuditLog("admin.email.scheduled.cancelled", {
    adminUserId: adminCheck.userId,
    triggerId,
  });

  return NextResponse.json({ ok: true });
}
