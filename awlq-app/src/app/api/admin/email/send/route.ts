import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { devAuditLog } from "@/lib/dev-audit";
import { prisma } from "@/lib/prisma";

type SendBody = {
  templateId?: string;
  subject?: string;
  html?: string;
  targetMode?: "all-users" | "single-user" | "specific-users";
  userId?: string;
  userIds?: string[];
};

export async function POST(request: NextRequest) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  const body = (await request.json().catch(() => ({}))) as SendBody;
  const templateId = body.templateId?.trim();
  const subject = body.subject?.trim();
  const html = body.html?.trim();
  const targetMode =
    body.targetMode === "single-user" ? "single-user" : body.targetMode === "specific-users" ? "specific-users" : "all-users";

  if (!templateId && !(subject && html)) {
    return NextResponse.json(
      { error: "Informe um template ou o assunto + conteudo do email." },
      { status: 400 },
    );
  }

  if (templateId) {
    const template = await prisma.adminEmailTemplate.findUnique({
      where: { id: templateId },
      select: { id: true, active: true },
    });

    if (!template || !template.active) {
      return NextResponse.json({ error: "Template nao encontrado ou inativo." }, { status: 404 });
    }
  }

  if (targetMode === "single-user" && !body.userId?.trim()) {
    return NextResponse.json({ error: "Informe o usuario para envio individual." }, { status: 400 });
  }

  const userIds = (body.userIds ?? []).map((id) => id.trim()).filter(Boolean);
  if (targetMode === "specific-users" && userIds.length === 0) {
    return NextResponse.json({ error: "Selecione ao menos um usuario." }, { status: 400 });
  }

  await prisma.workerTrigger.create({
    data: {
      action: "email-send",
      payload: {
        templateId: templateId ?? null,
        subject: templateId ? null : subject,
        html: templateId ? null : html,
        targetMode,
        userId: targetMode === "single-user" ? (body.userId?.trim() ?? null) : null,
        userIds: targetMode === "specific-users" ? userIds : null,
      },
    },
  });

  devAuditLog("admin.email.send.queued", {
    adminUserId: adminCheck.userId,
    templateId: templateId ?? "raw",
    targetMode,
  });

  return NextResponse.json({ queued: true, sent: 0, failed: 0 });
}
