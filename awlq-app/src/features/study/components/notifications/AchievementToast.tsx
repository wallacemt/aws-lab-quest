"use client";

const RARITY_COLOR: Record<string, string> = {
  common: "#94a3b8",
  uncommon: "#4ade80",
  rare: "#60a5fa",
  epic: "#c084fc",
  legendary: "#fbbf24",
};

type NewAchievement = {
  code: string;
  name: string;
  description: string;
  rarity: string;
  imageUrl?: string | null;
};

type Props = {
  achievement: NewAchievement;
};

export function AchievementToast({ achievement }: Props) {
  const color = RARITY_COLOR[achievement.rarity] ?? RARITY_COLOR.common;

  return (
    <div
      className="flex items-center gap-3 rounded-none border-2 bg-[var(--pixel-card)] px-4 py-3 shadow-[4px_4px_0_0_#000]"
      style={{ borderColor: color }}
    >
      {achievement.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={achievement.imageUrl} alt={achievement.name} className="h-10 w-10 object-contain" />
      ) : (
        <span className="text-2xl">🏆</span>
      )}
      <div>
        <p className="font-mono text-[10px] uppercase" style={{ color }}>
          Conquista desbloqueada!
        </p>
        <p className="font-mono text-sm font-bold text-[var(--pixel-text)]">{achievement.name}</p>
        <p className="font-mono text-[10px] text-[var(--pixel-subtext)]">{achievement.description}</p>
      </div>
    </div>
  );
}
