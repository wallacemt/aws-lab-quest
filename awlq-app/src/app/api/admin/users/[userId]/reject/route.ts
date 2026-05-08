import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { devAuditLog } from "@/lib/dev-audit";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ userId: string }>;
};

type Body = {
  reason?: string;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  const { userId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as Body;
  devAuditLog("admin.users.reject.request", {
    adminUserId: adminCheck.userId,
    userId,
    hasReason: Boolean(body.reason?.trim()),
  });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "Usuario nao encontrado." }, { status: 404 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      accessStatus: "rejected",
      accessDecisionAt: new Date(),
      accessDecisionReason: body.reason?.trim() || "Acesso recusado pelo administrador.",
    },
  });

  devAuditLog("admin.users.reject.completed", { adminUserId: adminCheck.userId, userId });

  return NextResponse.json({ ok: true });
}
