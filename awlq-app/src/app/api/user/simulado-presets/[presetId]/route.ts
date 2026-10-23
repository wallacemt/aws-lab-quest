import { NextRequest, NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/user-auth";
import { prisma } from "@/lib/prisma";

const styles = ["EXAM", "EXPLAIN_EACH"] as const;
const timers = ["COUNTDOWN_LOCK", "COUNTUP_FREE", "NONE"] as const;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ presetId: string }> }) {
  const auth = await requireApprovedUser(request);
  if (auth.response) return auth.response;
  const { presetId } = await params;
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "JSON invalido." }, { status: 400 }); }
  const data: { name?: string; examStyle?: typeof styles[number]; timerMode?: typeof timers[number]; timerMinutes?: number | null } = {};
  if (body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 40) return NextResponse.json({ error: "Nome invalido." }, { status: 422 });
    data.name = body.name.trim();
  }
  if (body.examStyle !== undefined) {
    if (!styles.includes(body.examStyle as typeof styles[number])) return NextResponse.json({ error: "Estilo invalido." }, { status: 422 });
    data.examStyle = body.examStyle as typeof styles[number];
  }
  if (body.timerMode !== undefined) {
    if (!timers.includes(body.timerMode as typeof timers[number])) return NextResponse.json({ error: "Cronometro invalido." }, { status: 422 });
    data.timerMode = body.timerMode as typeof timers[number];
  }
  if (body.timerMinutes !== undefined) {
    if (body.timerMinutes !== null && (!Number.isInteger(body.timerMinutes) || Number(body.timerMinutes) < 1 || Number(body.timerMinutes) > 600)) return NextResponse.json({ error: "Duracao invalida." }, { status: 422 });
    data.timerMinutes = body.timerMinutes as number | null;
  }
  if (!Object.keys(data).length) return NextResponse.json({ error: "Nenhum campo para atualizar." }, { status: 400 });
  const result = await prisma.simuladoConfigPreset.updateMany({ where: { id: presetId, userId: auth.user.id }, data });
  if (!result.count) return NextResponse.json({ error: "Preset nao encontrado." }, { status: 404 });
  return NextResponse.json({ preset: await prisma.simuladoConfigPreset.findUnique({ where: { id: presetId } }) });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ presetId: string }> }) {
  const auth = await requireApprovedUser(request);
  if (auth.response) return auth.response;
  const { presetId } = await params;
  const result = await prisma.simuladoConfigPreset.deleteMany({ where: { id: presetId, userId: auth.user.id } });
  if (!result.count) return NextResponse.json({ error: "Preset nao encontrado." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
