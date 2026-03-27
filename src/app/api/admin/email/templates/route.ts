import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { ensureSystemTemplates } from "@/lib/admin-email-templates";
import { devAuditLog } from "@/lib/dev-audit";
import { prisma } from "@/lib/prisma";

type CreateBody = {
  code?: string;
  name?: string;
  description?: string;
  subject?: string;
  html?: string;
  text?: string;
  active?: boolean;
};

function normalizeCode(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function GET(request: NextRequest) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  await ensureSystemTemplates();

  const templates = await prisma.adminEmailTemplate.findMany({
    orderBy: [{ isSystem: "desc" }, { updatedAt: "desc" }],
  });

  return NextResponse.json({ templates });
}

export async function POST(request: NextRequest) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  const body = (await request.json().catch(() => ({}))) as CreateBody;

  const code = normalizeCode(body.code ?? "");
  const name = body.name?.trim() ?? "";
  const subject = body.subject?.trim() ?? "";
  const html = body.html?.trim() ?? "";

  if (!code || !name || !subject || !html) {
    return NextResponse.json({ error: "Campos obrigatorios: code, name, subject e html." }, { status: 400 });
  }

  const exists = await prisma.adminEmailTemplate.findUnique({ where: { code } });
  if (exists) {
    return NextResponse.json({ error: "Ja existe template com este code." }, { status: 409 });
  }

  const template = await prisma.adminEmailTemplate.create({
    data: {
      code,
      name,
      description: body.description?.trim() || null,
      subject,
      html,
      text: body.text?.trim() || null,
      active: typeof body.active === "boolean" ? body.active : true,
      isSystem: false,
      createdByUserId: adminCheck.userId,
    },
  });

  devAuditLog("admin.email.templates.created", {
    adminUserId: adminCheck.userId,
    templateId: template.id,
    code: template.code,
  });

  return NextResponse.json({ template }, { status: 201 });
}
