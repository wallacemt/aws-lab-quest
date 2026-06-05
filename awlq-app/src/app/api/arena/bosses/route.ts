import { NextRequest, NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/user-auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/arena/bosses
 * Returns all active bosses with the user's current unfinished battle for each.
 */
export async function GET(request: NextRequest) {
  const auth = await requireApprovedUser(request);
  if (auth.response) return auth.response;

  const { user } = auth;

  const bosses = await prisma.boss.findMany({
    where: { active: true },
    orderBy: { createdAt: "asc" },
  });

  const activeBattles = await prisma.bossBattle.findMany({
    where: {
      userId: user.id,
      victory: false,
      finishedAt: null,
    },
    select: {
      id: true,
      bossId: true,
      remainingHp: true,
      victory: true,
      finishedAt: true,
    },
  });

  const battleByBossId = new Map(activeBattles.map((b) => [b.bossId, b]));

  const result = bosses.map((boss) => {
    const battle = battleByBossId.get(boss.id) ?? null;
    return {
      id: boss.id,
      name: boss.name,
      code: boss.code,
      themeService: boss.themeService,
      maxHp: boss.maxHp,
      damagePerCorrect: boss.damagePerCorrect,
      artworkUrl: boss.artworkUrl,
      active: boss.active,
      currentBattle: battle
        ? {
            id: battle.id,
            remainingHp: battle.remainingHp,
            victory: battle.victory,
            finishedAt: battle.finishedAt?.toISOString() ?? null,
          }
        : null,
    };
  });

  return NextResponse.json({ bosses: result });
}
