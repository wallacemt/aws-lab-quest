import { NextRequest, NextResponse } from "next/server";
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
  const now = new Date();
  const startDate = new Date(now.getTime() - days * MS_PER_DAY);
  const sevenDaysAgo = new Date(now.getTime() - 7 * MS_PER_DAY);

  const [
    totalApproved,
    newInPeriod,
    atRiskUsers,
    sessionDurationAgg,
    newUsersInPeriod,
    accessStatusGroups,
    studySessions,
    questXp,
  ] = await Promise.all([
    prisma.user.count({ where: { accessStatus: "approved", active: true } }),
    prisma.user.count({ where: { createdAt: { gte: startDate } } }),
    // Users who have been approved but silent for > 7 days
    prisma.user.findMany({
      where: {
        accessStatus: "approved",
        active: true,
        lastSeen: { lt: sevenDaysAgo },
      },
      take: 20,
      orderBy: { lastSeen: "asc" },
      select: { id: true, name: true, email: true, lastSeen: true },
    }),
    prisma.studySessionHistory.aggregate({
      where: { completedAt: { gte: startDate } },
      _avg: { durationSeconds: true },
    }),
    prisma.user.findMany({
      where: { createdAt: { gte: startDate } },
      select: { createdAt: true },
    }),
    prisma.user.groupBy({
      by: ["accessStatus"],
      _count: { _all: true },
    }),
    // Sessions for top performer calculation
    prisma.studySessionHistory.groupBy({
      by: ["userId"],
      _sum: { gainedXp: true },
      _count: { _all: true },
      orderBy: { _sum: { gainedXp: "desc" } },
      take: 20,
    }),
    prisma.questHistory.groupBy({
      by: ["userId"],
      _sum: { xp: true },
      orderBy: { _sum: { xp: "desc" } },
      take: 20,
    }),
  ]);

  // Build daily timeline for new users
  const timelineMap = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate.getTime() + i * MS_PER_DAY);
    timelineMap.set(formatDay(date), 0);
  }
  for (const user of newUsersInPeriod) {
    const key = formatDay(user.createdAt);
    timelineMap.set(key, (timelineMap.get(key) ?? 0) + 1);
  }

  // Merge XP from study sessions and quest history
  const xpMap = new Map<string, { totalXp: number; sessions: number }>();
  for (const s of studySessions) {
    xpMap.set(s.userId, {
      totalXp: s._sum.gainedXp ?? 0,
      sessions: s._count._all,
    });
  }
  for (const q of questXp) {
    const existing = xpMap.get(q.userId);
    if (existing) {
      existing.totalXp += q._sum.xp ?? 0;
    } else {
      xpMap.set(q.userId, { totalXp: q._sum.xp ?? 0, sessions: 0 });
    }
  }

  // Fetch names for top performers
  const topUserIds = Array.from(xpMap.entries())
    .sort((a, b) => b[1].totalXp - a[1].totalXp)
    .slice(0, 5)
    .map(([id]) => id);

  const topUsers =
    topUserIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: topUserIds } },
          select: { id: true, name: true },
        })
      : [];

  const userNameMap = new Map(topUsers.map((u) => [u.id, u.name]));

  const topPerformers = topUserIds.map((userId) => {
    const data = xpMap.get(userId)!;
    return {
      userId,
      name: userNameMap.get(userId) ?? "Usuario",
      totalXp: data.totalXp,
      sessions: data.sessions,
    };
  });

  return NextResponse.json({
    totalApproved,
    newInPeriod,
    atRiskCount: atRiskUsers.length,
    avgSessionDurationSeconds: Math.round(sessionDurationAgg._avg.durationSeconds ?? 0),
    newUsersOverTime: Array.from(timelineMap.entries()).map(([date, count]) => ({ date, count })),
    accessStatusBreakdown: accessStatusGroups.map((g) => ({
      status: g.accessStatus,
      count: g._count._all,
    })),
    topPerformers,
    atRisk: atRiskUsers.map((u) => ({
      userId: u.id,
      name: u.name,
      email: u.email,
      lastSeen: u.lastSeen.toISOString(),
      daysSilent: Math.floor((now.getTime() - u.lastSeen.getTime()) / MS_PER_DAY),
    })),
  });
}
