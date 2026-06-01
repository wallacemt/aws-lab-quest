import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

function parseDays(value: string | null): number {
  const parsed = Number(value ?? 30);
  if (!Number.isFinite(parsed)) return 30;
  return Math.max(7, Math.min(180, Math.round(parsed)));
}

function formatDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const MS_PER_DAY = 86_400_000;

export async function GET(request: NextRequest) {
  const authResult = await requireAdmin(request);
  if (!authResult.ok) return authResult.response;

  const days = parseDays(request.nextUrl.searchParams.get("days"));
  const startDate = new Date(Date.now() - days * MS_PER_DAY);

  const [kcAgg, simuladoAgg, avgXpAgg, avgDurAgg, sessionsInPeriod, hourData] = await Promise.all([
    prisma.studySessionHistory.count({
      where: { sessionType: "KC", completedAt: { gte: startDate } },
    }),
    prisma.studySessionHistory.count({
      where: { sessionType: "SIMULADO", completedAt: { gte: startDate } },
    }),
    prisma.studySessionHistory.aggregate({
      where: { completedAt: { gte: startDate } },
      _avg: { gainedXp: true },
    }),
    prisma.studySessionHistory.aggregate({
      where: { completedAt: { gte: startDate } },
      _avg: { durationSeconds: true },
    }),
    // For daily breakdown and XP histogram
    prisma.studySessionHistory.findMany({
      where: { completedAt: { gte: startDate } },
      select: { completedAt: true, sessionType: true, gainedXp: true },
    }),
    // Hour distribution via raw query — safe parameterized
    prisma.$queryRaw<Array<{ hour: number; count: bigint }>>(
      Prisma.sql`
        SELECT EXTRACT(HOUR FROM "completedAt")::int AS hour, COUNT(*) as count
        FROM "StudySessionHistory"
        WHERE "completedAt" >= ${startDate}
        GROUP BY hour
        ORDER BY hour
      `
    ),
  ]);

  // Build daily timeline by session type
  const timelineMap = new Map<string, { kc: number; simulado: number }>();
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate.getTime() + i * MS_PER_DAY);
    timelineMap.set(formatDay(date), { kc: 0, simulado: 0 });
  }
  for (const s of sessionsInPeriod) {
    const key = formatDay(s.completedAt);
    const bucket = timelineMap.get(key);
    if (bucket) {
      if (s.sessionType === "KC") {
        bucket.kc += 1;
      } else {
        bucket.simulado += 1;
      }
    }
  }

  // Build XP histogram
  const xpBuckets = { "0-50": 0, "51-100": 0, "101-200": 0, "201+": 0 };
  for (const s of sessionsInPeriod) {
    const xp = s.gainedXp;
    if (xp <= 50) xpBuckets["0-50"]++;
    else if (xp <= 100) xpBuckets["51-100"]++;
    else if (xp <= 200) xpBuckets["101-200"]++;
    else xpBuckets["201+"]++;
  }

  return NextResponse.json({
    kcSessions: kcAgg,
    simuladoSessions: simuladoAgg,
    avgXpPerSession: avgXpAgg._avg.gainedXp ?? 0,
    avgDurationSeconds: Math.round(avgDurAgg._avg.durationSeconds ?? 0),
    sessionsByTypeOverTime: Array.from(timelineMap.entries()).map(([date, value]) => ({
      date,
      kc: value.kc,
      simulado: value.simulado,
    })),
    mostActiveHours: hourData.map((row) => ({
      hour: row.hour,
      count: Number(row.count),
    })),
    xpHistogram: Object.entries(xpBuckets).map(([bucket, count]) => ({ bucket, count })),
  });
}
