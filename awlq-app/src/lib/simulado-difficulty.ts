export type SimuladoDifficulty = "easy" | "medium" | "hard";

// difficultyScore is a 1–5 authoring scale in the current seed; group it into three share labels.
export function getSimuladoDifficulty(score: number): SimuladoDifficulty {
  if (score <= 2) return "easy";
  if (score <= 3) return "medium";
  return "hard";
}

export function getSimuladoDifficultyLabel(score: number): string {
  const labels = { easy: "Fácil", medium: "Médio", hard: "Difícil" };
  return labels[getSimuladoDifficulty(score)];
}
