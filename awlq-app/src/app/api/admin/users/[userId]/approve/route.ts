import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import {
  buildTemplateVariables,
  ensureSystemTemplates,
  renderTemplateWithVariables,
} from "@/lib/admin-email-templates";
import { devAuditLog } from "@/lib/dev-audit";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

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
    let template = await prisma.adminEmailTemplate.findUnique({ where: { code: "free-access" } });

    if (!template) {
      await ensureSystemTemplates();
      template = await prisma.adminEmailTemplate.findUnique({ where: { code: "free-access" } });
    }

    if (!template || !template.active) {
      throw new Error("Template de acesso liberado nao encontrado ou inativo no banco de dados.");
    }

    const variables = buildTemplateVariables({ name: updated.name });
    const subject = renderTemplateWithVariables(template.subject, variables);
    const html = renderTemplateWithVariables(template.html, variables);

    await sendEmail({
      to: updated.email,
      subject,
      html,
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
