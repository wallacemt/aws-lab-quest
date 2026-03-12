import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getLevel } from "@/lib/levels";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const badges = await prisma.levelBadge.findMany({ orderBy: { level: "asc" } });

  // Backfill ownership for existing users based on current total XP.
  const totals = await prisma.questHistory.aggregate({
    where: { userId: session.user.id },
    _sum: { xp: true },
  });
  const totalXp = totals._sum.xp ?? 0;
  const currentLevel = getLevel(totalXp);

  const eligible = badges.filter((b) => b.level <= currentLevel.number);
  if (eligible.length > 0) {
    await prisma.$transaction(
      eligible.map((badge) =>
        prisma.userBadge.upsert({
          where: {
            userId_badgeId: {
              userId: session.user.id,
              badgeId: badge.id,
            },
          },
          create: {
            userId: session.user.id,
            badgeId: badge.id,
          },
          update: {},
        }),
      ),
    );
  }

  const owned = await prisma.userBadge.findMany({
    where: { userId: session.user.id },
    select: { badgeId: true, earnedAt: true },
  });

  return NextResponse.json({ badges, ownedBadgeIds: owned.map((b) => b.badgeId), ownedBadges: owned });
}
