import { LevelBadge } from "@/components/ui/level-badge";
import { PixelCard } from "@/components/ui/pixel-card";
import { getLevel, getLevelProgressPercent } from "@/lib/levels";

export function XPPanel({ xp }: { xp: number }) {
  const level = getLevel(xp);
  const progress = getLevelProgressPercent(xp);

  return (
    <PixelCard className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-[var(--font-pixel)] text-[10px] uppercase">Progresso: {xp} XP</p>
        <LevelBadge xp={xp} />
      </div>
      <div className="h-6 border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] p-1">
        <div className="h-full bg-[var(--pixel-primary)] transition-all" style={{ width: `${progress}%` }} />
      </div>
      <p className="font-[var(--font-pixel)] text-[10px] uppercase text-[var(--pixel-subtext)]">{level.next}</p>
    </PixelCard>
  );
}
