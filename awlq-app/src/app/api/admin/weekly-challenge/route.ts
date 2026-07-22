import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const challenges = await prisma.weeklyChallenge.findMany({
    orderBy: { weekStart: "desc" },
    include: {
      _count: { select: { entries: true } },
      entries: {
        orderBy: [{ score: "desc" }, { updatedAt: "asc" }],
        take: 3,
        select: { userId: true, score: true, rank: true, user: { select: { name: true } } },
      },
    },
  });

  return NextResponse.json({
    challenges: challenges.map((c) => ({
      id: c.id,
      weekStart: c.weekStart.toISOString(),
      weekEnd: c.weekEnd.toISOString(),
      active: c.active,
      badgeImageUrl: c.badgeImageUrl,
      entryCount: c._count.entries,
      topEntries: c.entries.map((e) => ({ userId: e.userId, name: e.user.name, score: e.score, rank: e.rank })),
    })),
  });
}
