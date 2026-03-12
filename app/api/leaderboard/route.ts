import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Aggregate XP and lab count per user, top 10
  const grouped = await prisma.questHistory.groupBy({
    by: ["userId"],
    _sum: { xp: true },
    _count: { id: true },
    orderBy: { _sum: { xp: "desc" } },
    take: 10,
  });

  const leaderboard = await Promise.all(
    grouped.map(async (entry, index) => {
      const user = await prisma.user.findUnique({
        where: { id: entry.userId },
        include: { profile: { select: { avatarUrl: true } } },
      });

      return {
        rank: index + 1,
        userId: entry.userId,
        name: user?.name ?? "Anônimo",
        avatarUrl: user?.profile?.avatarUrl ?? null,
        totalXp: entry._sum.xp ?? 0,
        labsCompleted: entry._count.id,
        isCurrentUser: entry.userId === session.user.id,
      };
    }),
  );

  return NextResponse.json({ leaderboard });
}
