"use client";

import type { Level } from "@/lib/types";

type Props = {
  level: Level;
};

export function LevelUpToast({ level }: Props) {
  return (
    <div className="flex items-center gap-3 rounded-none border-2 border-[var(--pixel-primary)] bg-[var(--pixel-card)] px-4 py-3 shadow-[4px_4px_0_0_#000]">
      <span className="text-2xl">⭐</span>
      <div>
        <p className="font-mono text-[10px] uppercase text-[var(--pixel-accent)]">Novo nível!</p>
        <p className="font-mono text-sm font-bold text-[var(--pixel-primary)]">{level.name}</p>
        <p className="font-mono text-[10px] text-[var(--pixel-subtext)]">Nivel {level.number.toString()} desbloqueado</p>
      </div>
    </div>
  );
}
