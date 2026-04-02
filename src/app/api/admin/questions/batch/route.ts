import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

type BatchAction = "set-active" | "set-usage" | "delete";

type BatchBody = {
  ids?: string[];
  action?: BatchAction;
  active?: boolean;
  usage?: "KC" | "SIMULADO" | "BOTH";
};

function normalizeIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(value.map((item) => (typeof item === "string" ? item.trim() : "")).filter((item) => item.length > 0)),
  );
}

export async function POST(request: NextRequest) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  let body: BatchBody;
  try {
    body = (await request.json()) as BatchBody;
  } catch {
    return NextResponse.json({ error: "Payload invalido." }, { status: 400 });
  }

  const ids = normalizeIds(body.ids);
  if (ids.length === 0) {
    return NextResponse.json({ error: "Nenhuma questao selecionada." }, { status: 400 });
  }

  const action = body.action;
  if (action !== "set-active" && action !== "set-usage" && action !== "delete") {
    return NextResponse.json({ error: "Acao em lote invalida." }, { status: 400 });
  }

  if (action === "set-active") {
    if (typeof body.active !== "boolean") {
      return NextResponse.json({ error: "Informe o status ativo/inativo para atualizacao em lote." }, { status: 400 });
    }

    const result = await prisma.studyQuestion.updateMany({
      where: {
        id: { in: ids },
      },
      data: {
        active: body.active,
      },
    });

    return NextResponse.json({
      ok: true,
      action,
      requested: ids.length,
      affected: result.count,
    });
  }

  if (action === "set-usage") {
    if (body.usage !== "KC" && body.usage !== "SIMULADO" && body.usage !== "BOTH") {
      return NextResponse.json({ error: "Uso invalido para atualizacao em lote." }, { status: 400 });
    }

    const result = await prisma.studyQuestion.updateMany({
      where: {
        id: { in: ids },
      },
      data: {
        usage: body.usage,
      },
    });

    return NextResponse.json({
      ok: true,
      action,
      requested: ids.length,
      affected: result.count,
    });
  }

  const result = await prisma.studyQuestion.deleteMany({
    where: {
      id: { in: ids },
    },
  });

  return NextResponse.json({
    ok: true,
    action,
    requested: ids.length,
    affected: result.count,
  });
}
