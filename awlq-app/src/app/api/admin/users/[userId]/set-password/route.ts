import { NextRequest, NextResponse } from "next/server";
import { hashPassword } from "better-auth/crypto";
import { requireAdmin } from "@/lib/admin-auth";
import { devAuditLog } from "@/lib/dev-audit";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ userId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) return adminCheck.response;

  const { userId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { password?: string };

  const password = typeof body.password === "string" ? body.password : "";
  if (password.length < 8) {
    return NextResponse.json({ error: "Senha deve ter no minimo 8 caracteres." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) {
    return NextResponse.json({ error: "Usuario nao encontrado." }, { status: 404 });
  }

  const hashed = await hashPassword(password);

  const existing = await prisma.account.findFirst({
    where: { userId, providerId: "credential" },
    select: { id: true },
  });

  if (existing) {
    await prisma.account.update({
      where: { id: existing.id },
      data: { password: hashed },
    });
  } else {
    await prisma.account.create({
      data: {
        accountId: userId,
        providerId: "credential",
        userId,
        password: hashed,
      },
    });
  }

  devAuditLog("admin.users.set-password", { adminUserId: adminCheck.userId, userId });

  return NextResponse.json({ ok: true });
}
