import { LevelBadge } from "@/components/ui/level-badge";
import { PixelCard } from "@/components/ui/pixel-card";
import { LEVELS, getLevel, getLevelProgressPercent } from "@/lib/levels";

export function XPPanel({ xp }: { xp: number }) {
  const level = getLevel(xp);
  const progress = getLevelProgressPercent(xp);
  const nextLevel = LEVELS.find((item) => item.number === level.number + 1) ?? null;
  const missingXp = nextLevel ? Math.max(0, nextLevel.min - xp) : 0;

  return (
    <PixelCard className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[10px] uppercase">Progresso: {xp} XP</p>
        <LevelBadge xp={xp} />
      </div>

      <div className="rounded border border-[var(--pixel-border)] bg-[var(--pixel-bg)] p-2">
        <p className="font-mono text-[9px] uppercase text-[var(--pixel-subtext)]">Status do badge</p>
        <p className="font-mono text-[11px] uppercase text-[var(--pixel-primary)]">{level.name}</p>
      </div>

      <div className="h-6 border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] p-1">
        <div className="h-full bg-[var(--pixel-primary)] transition-all" style={{ width: `${progress}%` }} />
      </div>

      <div className="space-y-1">
        <p className="font-mono text-[9px] uppercase text-[var(--pixel-subtext)]">
          {Math.round(progress)}% deste nivel
        </p>
        {nextLevel ? (
          <p className="font-mono text-[9px] uppercase text-[var(--pixel-subtext)]">
            Faltam {missingXp} XP para {nextLevel.name}
          </p>
        ) : (
          <p className="font-mono text-[9px] uppercase text-[var(--pixel-subtext)]">Nivel maximo alcancado</p>
        )}
      </div>
    </PixelCard>
  );
}
