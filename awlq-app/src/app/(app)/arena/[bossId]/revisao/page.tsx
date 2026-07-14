import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BossBattleReviewScreen, type BossBattleSnapshotEntry } from "@/features/arena/screens/BossBattleReviewScreen";

type Props = { params: Promise<{ bossId: string }> };

export default async function BossReviewPage({ params }: Props) {
  const { bossId } = await params;

  const boss = await prisma.boss.findUnique({
    where: { id: bossId, active: true },
    select: { id: true, name: true, artworkUrl: true },
  });
  if (!boss) notFound();

  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  if (!session?.user) notFound();

  const battle = await prisma.bossBattle.findFirst({
    where: { userId: session.user.id, bossId: boss.id, victory: true },
    select: { gainedXp: true, correctCount: true, totalAnswered: true, finishedAt: true, answersSnapshot: true },
  });
  if (!battle) notFound();

  return (
    <BossBattleReviewScreen
      boss={boss}
      gainedXp={battle.gainedXp}
      correctCount={battle.correctCount}
      totalAnswered={battle.totalAnswered}
      finishedAt={battle.finishedAt ? battle.finishedAt.toISOString() : null}
      answersSnapshot={(battle.answersSnapshot as unknown as BossBattleSnapshotEntry[] | null) ?? []}
    />
  );
}
