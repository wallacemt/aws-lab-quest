import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) return adminCheck.response;

  const fromParam = request.nextUrl.searchParams.get("from");
  const toParam = request.nextUrl.searchParams.get("to");
  const certificationCode = request.nextUrl.searchParams.get("certificationCode")?.trim() ?? "";

  if (!fromParam || !toParam) {
    return NextResponse.json({ error: "Parâmetros from e to são obrigatórios" }, { status: 400 });
  }

  const fromDate = startOfDay(new Date(fromParam));
  const toDate = endOfDay(new Date(toParam));

  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    return NextResponse.json({ error: "Datas inválidas" }, { status: 400 });
  }

  const where: Parameters<typeof prisma.studyQuestion.findMany>[0]["where"] = {
    createdAt: { gte: fromDate, lte: toDate },
  };

  if (certificationCode) {
    where.certificationPreset = { code: certificationCode };
  }

  const questions = await prisma.studyQuestion.findMany({
    where,
    select: { createdAt: true, difficulty: true, certificationPreset: { select: { code: true } } },
    orderBy: { createdAt: "asc" },
  });

  // Agrupa por dia (UTC)
  const dayMap = new Map<string, { total: number; easy: number; medium: number; hard: number; nightmare: number }>();

  // Preenche todos os dias do intervalo com zero
  const cur = new Date(fromDate);
  while (cur <= toDate) {
    const key = toDateStr(cur);
    dayMap.set(key, { total: 0, easy: 0, medium: 0, hard: 0, nightmare: 0 });
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  for (const q of questions) {
    const key = toDateStr(q.createdAt);
    const entry = dayMap.get(key) ?? { total: 0, easy: 0, medium: 0, hard: 0, nightmare: 0 };
    entry.total++;
    if (q.difficulty === "easy") entry.easy++;
    else if (q.difficulty === "medium") entry.medium++;
    else if (q.difficulty === "hard") entry.hard++;
    else entry.nightmare++;
    dayMap.set(key, entry);
  }

  const days = Array.from(dayMap.entries()).map(([date, counts]) => ({ date, ...counts }));
  const total = questions.length;
  const peak = days.reduce((max, d) => (d.total > max ? d.total : max), 0);

  return NextResponse.json({ days, total, peak, from: toDateStr(fromDate), to: toDateStr(toDate) });
}
