import { notFound } from "next/navigation";
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
    currentBattle: null, // BattleStageScreen loads live battle state via API
  };

  return <BattleStageScreen boss={bossData} />;
}
