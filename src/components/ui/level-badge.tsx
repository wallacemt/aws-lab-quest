import { getLevel } from "@/lib/levels";
import type { LevelTone } from "@/lib/types";

const TONE_CLASS: Record<LevelTone, string> = {
  base: "bg-sky-500 text-black",
  "base-mid": "bg-teal-500 text-black",
  mid: "bg-violet-500 text-white",
  "mid-top": "bg-red-500 text-white",
  top: "bg-orange-500 text-black",
  legendary: "bg-yellow-400 text-black",
};

export function LevelBadge({ xp }: { xp: number }) {
  const level = getLevel(xp);
  const toneClass = TONE_CLASS[level.tone];

  return (
    <span
      className={`inline-flex border-2 border-black px-3 py-1 font-mono text-[10px] uppercase ${toneClass}`}
    >
      {level.name}
    </span>
  );
}
