import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BattleStageScreen } from "@/features/arena/screens/BattleStageScreen";

type Props = { params: Promise<{ bossId: string }> };

export default async function BossPage({ params }: Props) {
  const { bossId } = await params;

  const boss = await prisma.boss.findUnique({
    where: { id: bossId, active: true },
  });

  if (!boss) {
    notFound();
  }

  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  // Only one BossBattle row exists per (userId, bossId) — it transitions in place to victory=true.
  const existingBattle = session?.user
    ? await prisma.bossBattle.findFirst({
        where: { userId: session.user.id, bossId: boss.id },
        select: { id: true, remainingHp: true, victory: true, finishedAt: true },
      })
    : null;

  // Already defeated: send to the review screen instead of letting a rebattle attempt
  // hit the 409 "alreadyDefeated" gate in /api/arena/battle.
  if (existingBattle?.victory) {
    redirect(`/arena/${boss.id}/revisao`);
  }

  const currentBattle = existingBattle;

  // Pass a minimal serializable version to the client component
  const bossData = {
    id: boss.id,
    name: boss.name,
    code: boss.code,
    themeService: boss.themeService,
    maxHp: boss.maxHp,
    damagePerCorrect: boss.damagePerCorrect,
    artworkUrl: boss.artworkUrl,
    active: boss.active,
    defeated: false,
    currentBattle: currentBattle
      ? {
          id: currentBattle.id,
          remainingHp: currentBattle.remainingHp,
          victory: currentBattle.victory,
          finishedAt: currentBattle.finishedAt ? currentBattle.finishedAt.toISOString() : null,
        }
      : null,
  };

  return <BattleStageScreen boss={bossData} />;
}
