import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAdmin(req);
    if (!authResult.ok) return authResult.response;

    let body: { displayName?: string; url?: string; certificationPresetId?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
    }

    const { displayName, url, certificationPresetId } = body;

    if (!displayName?.trim() || !url?.trim()) {
      return NextResponse.json({ error: "displayName e url são obrigatórios" }, { status: 422 });
    }

    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: "URL inválida" }, { status: 422 });
    }

    const source = await prisma.ingestionSource.create({
      data: {
        displayName: displayName.trim(),
        url: url.trim(),
        certificationPresetId: certificationPresetId || null,
        status: "PENDING",
      },
      select: { id: true, displayName: true, url: true, status: true },
    });

    return NextResponse.json({ ok: true, source }, { status: 201 });
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return NextResponse.json({ error: "Já existe uma fonte com essa URL" }, { status: 409 });
    }
    console.error("POST /api/admin/ingestion-sources error:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const authResult = await requireAdmin(req);
    if (!authResult.ok) return authResult.response;

    let body: { id?: string; active?: boolean };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
    }

    if (!body.id || typeof body.active !== "boolean") {
      return NextResponse.json({ error: "id e active são obrigatórios" }, { status: 422 });
    }

    await prisma.ingestionSource.update({
      where: { id: body.id },
      data: { active: body.active },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PATCH /api/admin/ingestion-sources error:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
