import { Level, TaskDifficulty } from "@/lib/types";

export const XP_PER_TASK = 100;
export const TASK_DIFFICULTY_MULTIPLIER: Record<TaskDifficulty, number> = {
  easy: 0.8,
  medium: 1,
  hard: 1.4,
};

export function getTaskXpByDifficulty(difficulty: TaskDifficulty): number {
  return Math.round(XP_PER_TASK * TASK_DIFFICULTY_MULTIPLIER[difficulty]);
}

// Exponential thresholds — each tier is roughly double the previous gap
export const LEVELS: Level[] = [
  { number: 1, name: "Recruta", min: 0, max: 1500, next: "1500 XP → Cadete", tone: "base" },
  { number: 2, name: "Cadete", min: 1500, max: 4500, next: "4500 XP → Explorador", tone: "base-mid" },
  { number: 3, name: "Explorador", min: 4500, max: 12000, next: "12000 XP → Especialista", tone: "mid" },
  { number: 4, name: "Especialista", min: 12000, max: 28000, next: "28000 XP → Guardião AWS", tone: "mid-top" },
  { number: 5, name: "Guardião AWS", min: 28000, max: 60000, next: "60000 XP → Lendário", tone: "top" },
  { number: 6, name: "Lendário", min: 60000, max: 999999999, next: "NÍVEL MÁXIMO", tone: "legendary" },
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
