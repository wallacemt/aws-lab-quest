import { Level } from "@/lib/types";

export const XP_PER_TASK = 100;

// Exponential thresholds — each tier is roughly double the previous gap
export const LEVELS: Level[] = [
  { number: 1, name: "Recruta", min: 0, max: 1000, next: "1000 XP → Cadete", tone: "base" },
  { number: 2, name: "Cadete", min: 3000, max: 5000, next: "5000 XP → Explorador", tone: "base-mid" },
  { number: 3, name: "Explorador", min: 10000, max: 20000, next: "20000 XP → Especialista", tone: "mid" },
  { number: 4, name: "Especialista", min: 25000, max: 35000, next: "35000 XP → Guardião AWS", tone: "mid-top" },
  { number: 5, name: "Guardião AWS", min: 45000, max: 60000, next: "60000 XP → Lendário", tone: "top" },
  { number: 6, name: "Lendário", min: 100000, max: 99999, next: "NÍVEL MÁXIMO", tone: "legendary" },
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
