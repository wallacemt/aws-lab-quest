/**
 * Client-side fetchers for /api/daily-quiz.
 * All functions throw on non-OK responses so callers can handle errors uniformly.
 */

export type DailyQuizQuestion = {
  id: string;
  statement: string;
  topic: string;
  difficulty: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  optionE?: string | null;
};

export type DailyQuizAttempt = {
  score: number;
  totalCount: number;
  gainedXp: number;
  completedAt: string;
};

export type DailyQuizStatus =
  | { locked: true; reason: string }
  | { locked?: false; completed: true; attempt: DailyQuizAttempt }
  | { locked?: false; completed: false; quiz: null }
  | { locked?: false; completed: false; quiz: { id: string; quizDate: string; questions: DailyQuizQuestion[] } };

export type DailyQuizResult = {
  score: number;
  totalCount: number;
  gainedXp: number;
  newAchievements: { code: string; name: string; description: string }[];
  historyId: string;
};

export class DailyQuizAlreadyDoneError extends Error {
  constructor() {
    super("Voce ja respondeu o quiz de hoje.");
    this.name = "DailyQuizAlreadyDoneError";
  }
}

export async function fetchDailyQuiz(): Promise<DailyQuizStatus> {
  const response = await fetch("/api/daily-quiz");
  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${await response.text()}`);
  }
  return response.json() as Promise<DailyQuizStatus>;
}

export async function submitDailyQuiz(
  answers: { questionId: string; selectedOption: number }[],
): Promise<DailyQuizResult> {
  const response = await fetch("/api/daily-quiz", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers }),
  });
  if (response.status === 409) {
    throw new DailyQuizAlreadyDoneError();
  }
  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `API error ${response.status}`);
  }
  return response.json() as Promise<DailyQuizResult>;
}
