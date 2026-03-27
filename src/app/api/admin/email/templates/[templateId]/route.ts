import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { devAuditLog } from "@/lib/dev-audit";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ templateId: string }>;
};

type PatchBody = {
  name?: string;
  description?: string;
  subject?: string;
  html?: string;
  text?: string;
  active?: boolean;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  const { templateId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as PatchBody;

  const current = await prisma.adminEmailTemplate.findUnique({ where: { id: templateId } });
  if (!current) {
    return NextResponse.json({ error: "Template nao encontrado." }, { status: 404 });
  }

  const data: {
    name?: string;
    description?: string | null;
    subject?: string;
    html?: string;
    text?: string | null;
    active?: boolean;
  } = {};

  if (typeof body.name === "string" && body.name.trim()) {
    data.name = body.name.trim();
  }

  if (typeof body.description === "string") {
    data.description = body.description.trim() || null;
  }

  if (typeof body.subject === "string" && body.subject.trim()) {
    data.subject = body.subject.trim();
  }

  if (typeof body.html === "string" && body.html.trim()) {
    data.html = body.html.trim();
  }

  if (typeof body.text === "string") {
    data.text = body.text.trim() || null;
  }

  if (typeof body.active === "boolean") {
    data.active = body.active;
  }

  const template = await prisma.adminEmailTemplate.update({
    where: { id: templateId },
    data,
  });

  devAuditLog("admin.email.templates.updated", {
    adminUserId: adminCheck.userId,
    templateId,
    fields: Object.keys(data),
  });

  return NextResponse.json({ template });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  const { templateId } = await context.params;
  const current = await prisma.adminEmailTemplate.findUnique({ where: { id: templateId } });
  if (!current) {
    return NextResponse.json({ error: "Template nao encontrado." }, { status: 404 });
  }

  if (current.isSystem) {
    return NextResponse.json({ error: "Templates de sistema nao podem ser removidos." }, { status: 400 });
  }

  await prisma.adminEmailTemplate.delete({ where: { id: templateId } });

  devAuditLog("admin.email.templates.deleted", {
    adminUserId: adminCheck.userId,
    templateId,
    code: current.code,
  });

  return NextResponse.json({ ok: true });
}
