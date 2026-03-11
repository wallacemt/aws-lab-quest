import { Level } from "@/lib/types";

export const XP_PER_TASK = 100;

export const LEVELS: Level[] = [
  { name: "Iniciante", min: 0, max: 300, next: "300 XP -> Explorador", tone: "base" },
  { name: "Explorador", min: 300, max: 700, next: "700 XP -> AWS Hero", tone: "mid" },
  { name: "AWS Hero", min: 700, max: 9999, next: "NIVEL MAXIMO", tone: "top" },
];

export function getLevel(xp: number): Level {
  return LEVELS.find((level) => xp >= level.min && xp < level.max) ?? LEVELS[2];
}

export function getLevelProgressPercent(xp: number): number {
  const level = getLevel(xp);
  if (level.name === "AWS Hero") {
    return 100;
  }

  return Math.max(0, Math.min(100, ((xp - level.min) / (level.max - level.min)) * 100));
}
