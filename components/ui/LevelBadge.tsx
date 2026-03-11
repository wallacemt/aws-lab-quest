import { getLevel } from "@/lib/levels";

export function LevelBadge({ xp }: { xp: number }) {
  const level = getLevel(xp);

  const toneClass =
    level.tone === "top"
      ? "bg-orange-500 text-black"
      : level.tone === "mid"
        ? "bg-violet-500 text-white"
        : "bg-sky-500 text-black";

  return (
    <span
      className={`inline-flex border-2 border-black px-3 py-1 font-[var(--font-pixel)] text-[10px] uppercase ${toneClass}`}
    >
      {level.name}
    </span>
  );
}
