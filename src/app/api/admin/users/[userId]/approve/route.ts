import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { devAuditLog } from "@/lib/dev-audit";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { renderFreeAcessTemplate } from "@/features/admin/email/templates";

type RouteContext = {
  params: Promise<{ userId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  const { userId } = await context.params;
  devAuditLog("admin.users.approve.request", { adminUserId: adminCheck.userId, userId });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "Usuario nao encontrado." }, { status: 404 });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      active: true,
      accessStatus: "approved",
      accessDecisionAt: new Date(),
      accessDecisionReason: "Acesso liberado pelo administrador.",
    },
    select: { email: true, name: true },
  });

  try {
    const content = renderFreeAcessTemplate({ name: updated.name });
    await sendEmail({
      to: updated.email,
      subject: content.subject,
      html: content.html,
    });
  } catch (error) {
    devAuditLog("admin.users.approve.email-warning", {
      adminUserId: adminCheck.userId,
      userId,
      warning: error instanceof Error ? error.message : "Falha ao enviar email de liberacao.",
    });
    return NextResponse.json(
      {
        ok: true,
        warning: error instanceof Error ? error.message : "Falha ao enviar email de liberacao.",
      },
      { status: 200 },
    );
  }

  devAuditLog("admin.users.approve.completed", { adminUserId: adminCheck.userId, userId });

  return NextResponse.json({ ok: true });
}
