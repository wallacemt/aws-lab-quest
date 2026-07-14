"use client";

export type BossWithBattle = {
  id: string;
  name: string;
  code: string;
  themeService: string;
  maxHp: number;
  damagePerCorrect: number;
  artworkUrl: string | null;
  active: boolean;
  defeated: boolean;
  currentBattle: {
    id: string;
    remainingHp: number;
    victory: boolean;
    finishedAt: string | null;
  } | null;
};

export type BattleResult = {
  remainingHp: number;
  damage: number;
  correct: boolean;
  streak: number;
  victory: boolean;
  gainedXp?: number;
  newAchievements?: { code: string; name: string }[];
};

export type WeeklyChallengeData = {
  challenge: {
    id: string;
    weekStart: string;
    weekEnd: string;
    active: boolean;
  } | null;
  entry: {
    score: number;
    rank: number | null;
    gainedXp: number;
  } | null;
  leaderboard: Array<{
    userId: string;
    score: number;
    rank: number | null;
  }>;
  submitted: boolean;
};

export type WeeklyChallengeSubmitResult = {
  score: number;
  gainedXp: number;
  newAchievements?: { code: string; name: string }[];
};

export async function fetchBosses(): Promise<BossWithBattle[]> {
  const res = await fetch("/api/arena/bosses");
  if (!res.ok) throw new Error("Failed to fetch bosses");
  const data = (await res.json()) as { bosses: BossWithBattle[] };
  return data.bosses;
}

export async function submitBattle(
  bossId: string,
  answers: { questionId: string; selectedOption: number }[],
): Promise<BattleResult> {
  const res = await fetch("/api/arena/battle", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bossId, answers }),
  });
  if (!res.ok) {
    const err = (await res.json()) as { error?: string; alreadyDefeated?: boolean };
    if (err.alreadyDefeated) {
      throw new Error("ALREADY_DEFEATED");
    }
    throw new Error(err.error ?? "Battle submission failed");
  }
  return res.json() as Promise<BattleResult>;
}

export async function fetchWeeklyChallenge(): Promise<WeeklyChallengeData> {
  const res = await fetch("/api/weekly-challenge");
  if (!res.ok) throw new Error("Failed to fetch weekly challenge");
  return res.json() as Promise<WeeklyChallengeData>;
}

export async function submitWeeklyChallenge(
  answers: { questionId: string; selectedOption: number }[],
): Promise<WeeklyChallengeSubmitResult> {
  const res = await fetch("/api/weekly-challenge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers }),
  });
  if (!res.ok) {
    const err = (await res.json()) as { error?: string };
    throw new Error(err.error ?? "Weekly challenge submission failed");
  }
  return res.json() as Promise<WeeklyChallengeSubmitResult>;
}
