import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if (!authResult.ok) return authResult.response;

    const cfg = await prisma.systemConfig.findUnique({
      where: { key: "auto_approve_users" },
    });

    return NextResponse.json({ autoApproveUsers: cfg?.value === "true" });
  } catch (error) {
    console.error("GET /api/admin/config error:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if (!authResult.ok) return authResult.response;

    const body = (await request.json()) as { autoApproveUsers?: boolean };

    if (typeof body.autoApproveUsers !== "boolean") {
      return NextResponse.json({ error: "autoApproveUsers deve ser boolean" }, { status: 400 });
    }

    await prisma.systemConfig.upsert({
      where: { key: "auto_approve_users" },
      create: { key: "auto_approve_users", value: body.autoApproveUsers ? "true" : "false" },
      update: { value: body.autoApproveUsers ? "true" : "false" },
    });

    return NextResponse.json({ autoApproveUsers: body.autoApproveUsers });
  } catch (error) {
    console.error("PATCH /api/admin/config error:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
