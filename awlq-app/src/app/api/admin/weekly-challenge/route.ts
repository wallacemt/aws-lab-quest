import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { OPEN_CRON_JOB_ID } from "@/app/api/admin/weekly-challenge/pause/route";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const [challenges, openCronJob] = await Promise.all([
    prisma.weeklyChallenge.findMany({
      orderBy: { weekStart: "desc" },
      include: {
        _count: { select: { entries: true } },
        entries: {
          orderBy: [{ score: "desc" }, { updatedAt: "asc" }],
          take: 3,
          select: { userId: true, score: true, rank: true, user: { select: { name: true } } },
        },
      },
    }),
    prisma.scheduledJob.findUnique({ where: { jobId: OPEN_CRON_JOB_ID }, select: { active: true } }),
  ]);

  return NextResponse.json({
    openCronPaused: openCronJob ? !openCronJob.active : false,
    challenges: challenges.map((c) => ({
      id: c.id,
      title: c.title,
      weekStart: c.weekStart.toISOString(),
      weekEnd: c.weekEnd.toISOString(),
      active: c.active,
      badgeImageUrl: c.badgeImageUrl,
      entryCount: c._count.entries,
      topEntries: c.entries.map((e) => ({ userId: e.userId, name: e.user.name, score: e.score, rank: e.rank })),
    })),
  });
}
