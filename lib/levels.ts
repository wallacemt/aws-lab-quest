import { Level } from "@/lib/types";

export const XP_PER_TASK = 100;

// Exponential thresholds — each tier is roughly double the previous gap
export const LEVELS: Level[] = [
  { number: 1, name: "Recruta", min: 0, max: 200, next: "200 XP → Cadete", tone: "base" },
  { number: 2, name: "Cadete", min: 200, max: 500, next: "500 XP → Explorador", tone: "base-mid" },
  { number: 3, name: "Explorador", min: 500, max: 1000, next: "1000 XP → Especialista", tone: "mid" },
  { number: 4, name: "Especialista", min: 1000, max: 2000, next: "2000 XP → Guardião AWS", tone: "mid-top" },
  { number: 5, name: "Guardião AWS", min: 2000, max: 4000, next: "4000 XP → Lendário", tone: "top" },
  { number: 6, name: "Lendário", min: 4000, max: 99999, next: "NÍVEL MÁXIMO", tone: "legendary" },
];

export function getLevel(xp: number): Level {
  // Walk from highest to lowest, return first level where xp >= min
  return [...LEVELS].reverse().find((level) => xp >= level.min) ?? LEVELS[0];
}

export function getLevelProgressPercent(xp: number): number {
  const level = getLevel(xp);
  if (level.tone === "legendary") return 100;
  return Math.max(0, Math.min(100, ((xp - level.min) / (level.max - level.min)) * 100));
}
