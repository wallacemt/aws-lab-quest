import { NextRequest, NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/user-auth";
import { prisma } from "@/lib/prisma";

const MAX_PRESETS_PER_USER = 12;
const MAX_NAME_LENGTH = 40;
const styles = ["EXAM", "EXPLAIN_EACH"] as const;
const timers = ["COUNTDOWN_LOCK", "COUNTUP_FREE", "NONE"] as const;

function validConfig(value: Record<string, unknown>) {
  return styles.includes(value.examStyle as typeof styles[number]) &&
    timers.includes(value.timerMode as typeof timers[number]) &&
    (value.timerMinutes === null || (Number.isInteger(value.timerMinutes) && Number(value.timerMinutes) >= 1 && Number(value.timerMinutes) <= 600));
}

export async function GET(request: NextRequest) {
  const auth = await requireApprovedUser(request);
  if (auth.response) return auth.response;
  const presets = await prisma.simuladoConfigPreset.findMany({ where: { userId: auth.user.id }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ presets });
}

export async function POST(request: NextRequest) {
  const auth = await requireApprovedUser(request);
  if (auth.response) return auth.response;
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "JSON invalido." }, { status: 400 }); }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > MAX_NAME_LENGTH) return NextResponse.json({ error: `Nome deve ter entre 1 e ${MAX_NAME_LENGTH} caracteres.` }, { status: 422 });
  if (!validConfig(body)) return NextResponse.json({ error: "Configuracao invalida." }, { status: 422 });
  if (await prisma.simuladoConfigPreset.count({ where: { userId: auth.user.id } }) >= MAX_PRESETS_PER_USER) return NextResponse.json({ error: `Limite de ${MAX_PRESETS_PER_USER} presets atingido.` }, { status: 422 });
  const preset = await prisma.simuladoConfigPreset.create({ data: { userId: auth.user.id, name, examStyle: body.examStyle as typeof styles[number], timerMode: body.timerMode as typeof timers[number], timerMinutes: body.timerMinutes as number | null } });
  return NextResponse.json({ preset });
}
