import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { buildTemplateVariables, renderTemplateWithVariables } from "@/lib/admin-email-templates";
import { devAuditLog } from "@/lib/dev-audit";
import { sendEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

type SendBody = {
  templateId?: string;
  targetMode?: "all-users" | "single-user";
  userId?: string;
};

export async function POST(request: NextRequest) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  const body = (await request.json().catch(() => ({}))) as SendBody;
  const templateId = body.templateId?.trim();
  const targetMode = body.targetMode === "single-user" ? "single-user" : "all-users";

  if (!templateId) {
    return NextResponse.json({ error: "Template obrigatorio." }, { status: 400 });
  }

  const template = await prisma.adminEmailTemplate.findUnique({ where: { id: templateId } });
  if (!template || !template.active) {
    return NextResponse.json({ error: "Template nao encontrado ou inativo." }, { status: 404 });
  }

  let recipients: Array<{ id: string; name: string; email: string }> = [];

  if (targetMode === "single-user") {
    const userId = body.userId?.trim();
    if (!userId) {
      return NextResponse.json({ error: "Informe o usuario para envio individual." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, active: true, accessStatus: true },
    });

    if (!user || user.role !== "user" || !user.active || user.accessStatus !== "approved") {
      return NextResponse.json({ error: "Usuario alvo nao elegivel para envio." }, { status: 400 });
    }

    recipients = [{ id: user.id, name: user.name, email: user.email }];
  } else {
    const users = await prisma.user.findMany({
      where: {
        role: "user",
        active: true,
        accessStatus: "approved",
      },
      select: { id: true, name: true, email: true },
      take: 1000,
    });

    recipients = users;
  }

  devAuditLog("admin.email.send.request", {
    adminUserId: adminCheck.userId,
    templateId,
    targetMode,
    recipients: recipients.length,
  });

  let sent = 0;
  let failed = 0;

  for (const recipient of recipients) {
    try {
      const variables = buildTemplateVariables({ name: recipient.name });
      const subject = renderTemplateWithVariables(template.subject, variables);
      const html = renderTemplateWithVariables(template.html, variables);

      await sendEmail({
        to: recipient.email,
        subject,
        html,
      });

      sent += 1;
    } catch {
      failed += 1;
    }
  }

  devAuditLog("admin.email.send.completed", {
    adminUserId: adminCheck.userId,
    templateId,
    targetMode,
    sent,
    failed,
  });

  return NextResponse.json({ sent, failed });
}
