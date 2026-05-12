import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { devAuditLog } from "@/lib/dev-audit";
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

  const template = await prisma.adminEmailTemplate.findUnique({
    where: { id: templateId },
    select: { id: true, active: true },
  });

  if (!template || !template.active) {
    return NextResponse.json({ error: "Template nao encontrado ou inativo." }, { status: 404 });
  }

  if (targetMode === "single-user") {
    const userId = body.userId?.trim();
    if (!userId) {
      return NextResponse.json({ error: "Informe o usuario para envio individual." }, { status: 400 });
    }
  }

  await prisma.workerTrigger.create({
    data: {
      action: "email-send",
      payload: {
        templateId,
        targetMode,
        userId: targetMode === "single-user" ? (body.userId?.trim() ?? null) : null,
      },
    },
  });

  devAuditLog("admin.email.send.queued", {
    adminUserId: adminCheck.userId,
    templateId,
    targetMode,
  });

  return NextResponse.json({ queued: true, sent: 0, failed: 0 });
}
