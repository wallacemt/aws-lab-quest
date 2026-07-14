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

  // Only one BossBattle row exists per (userId, bossId) — it transitions in place to victory=true.
  const battles = await prisma.bossBattle.findMany({
    where: { userId: user.id, bossId: { in: bosses.map((b) => b.id) } },
    select: {
      id: true,
      bossId: true,
      remainingHp: true,
      victory: true,
      finishedAt: true,
    },
  });

  const battleByBossId = new Map(battles.map((b) => [b.bossId, b]));

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
      defeated: Boolean(battle?.victory),
      currentBattle: battle && !battle.victory
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
