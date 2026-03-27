import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { devAuditLog } from "@/lib/dev-audit";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ userId: string }>;
};

type PatchBody = {
  name?: string;
  role?: string;
  accessStatus?: "pending" | "approved" | "rejected";
  accessDecisionReason?: string;
  active?: boolean;
};

async function ensureNotLastActiveAdmin(userId: string, nextRole?: string, nextActive?: boolean): Promise<boolean> {
  const current = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, active: true } });
  if (!current) {
    return false;
  }

  const roleAfter = nextRole ?? current.role;
  const activeAfter = typeof nextActive === "boolean" ? nextActive : current.active;

  if (!(current.role === "admin" && current.active)) {
    return true;
  }

  if (roleAfter === "admin" && activeAfter) {
    return true;
  }

  const activeAdmins = await prisma.user.count({ where: { role: "admin", active: true } });
  return activeAdmins > 1;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  const { userId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as PatchBody;
  devAuditLog("admin.users.patch.request", {
    adminUserId: adminCheck.userId,
    userId,
    fields: Object.keys(body ?? {}),
  });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "Usuario nao encontrado." }, { status: 404 });
  }

  const allowed = await ensureNotLastActiveAdmin(userId, body.role, body.active);
  if (!allowed) {
    return NextResponse.json({ error: "Nao e permitido remover o ultimo admin ativo." }, { status: 400 });
  }

  const data: {
    name?: string;
    role?: string;
    accessStatus?: "pending" | "approved" | "rejected";
    accessDecisionReason?: string;
    accessDecisionAt?: Date;
    active?: boolean;
  } = {};

  if (typeof body.name === "string" && body.name.trim()) {
    data.name = body.name.trim();
  }

  if (typeof body.role === "string" && body.role.trim()) {
    data.role = body.role.trim();
  }

  if (body.accessStatus === "pending" || body.accessStatus === "approved" || body.accessStatus === "rejected") {
    data.accessStatus = body.accessStatus;
    data.accessDecisionAt = new Date();
    data.accessDecisionReason = body.accessDecisionReason?.trim() || `Status alterado para ${body.accessStatus}.`;
  }

  if (typeof body.active === "boolean") {
    data.active = body.active;
  }

  await prisma.user.update({ where: { id: userId }, data });

  devAuditLog("admin.users.patch.completed", {
    adminUserId: adminCheck.userId,
    userId,
    fields: Object.keys(data),
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  const { userId } = await context.params;
  devAuditLog("admin.users.delete.request", { adminUserId: adminCheck.userId, userId });

  const allowed = await ensureNotLastActiveAdmin(userId, undefined, false);
  if (!allowed) {
    return NextResponse.json({ error: "Nao e permitido desativar o ultimo admin ativo." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "Usuario nao encontrado." }, { status: 404 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      active: false,
      accessDecisionAt: new Date(),
      accessDecisionReason: "Conta desativada pelo administrador.",
    },
  });

  devAuditLog("admin.users.delete.completed", { adminUserId: adminCheck.userId, userId });

  return NextResponse.json({ ok: true });
}
