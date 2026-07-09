/**
 * Client-side fetchers for the retention API routes.
 * All functions throw on non-OK responses so callers can handle errors uniformly.
 */

export type FlashcardGrade = "VERY_HARD" | "HARD" | "GOOD" | "EASY";

export type Flashcard = {
  id: string;
  front: string;
  back: string;
  hint: string | null;
  source: string;
  awsServiceId: string | null;
  topic: string | null;
  easeFactor: number;
  intervalDays: number;
  dueAt: string;
};

export type StudyQuestionLite = {
  id: string;
  statement: string;
  topic: string;
  difficulty: string;
  awsService?: { code: string; name: string } | null;
};

export type SprintQuestion = {
  id: string;
  statement: string;
  topic: string;
  difficulty: string;
  questionType: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  optionE?: string | null;
  correctOption: string;
  correctOptions?: string[] | null;
  awsService?: { code: string; name: string } | null;
};

export type SprintData = {
  questions: SprintQuestion[];
  mode: string;
  limitSeconds: number | null;
};

export type SprintResult = {
  scorePercent: number;
  gainedXp: number;
  streakDays: number;
  newAchievements: { code: string; name: string; description: string }[];
  historyId: string;
};

export type MemoryRecoveryItem = {
  question: StudyQuestionLite;
  lastCorrectAt: string;
  daysSince: number;
};

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error ${response.status}: ${error}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchDueFlashcards(): Promise<{ cards: Flashcard[]; dueTotal: number }> {
  return apiFetch("/api/retention/flashcards");
}

export async function submitFlashcardGrades(
  grades: { flashcardId: string; grade: FlashcardGrade }[],
): Promise<{ updated: number; nextDueCounts: { today: number; tomorrow: number } }> {
  return apiFetch("/api/retention/flashcards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grades }),
  });
}

export async function enqueueFlashcardGeneration(): Promise<{ enqueued: boolean }> {
  return apiFetch("/api/retention/flashcards/generate", { method: "POST" });
}

export type FlashcardInput = {
  front: string;
  back: string;
  hint?: string | null;
  awsServiceId?: string | null;
  topic?: string | null;
};

/** Lists flashcards the current user created themselves (source = USER_CREATED). */
export async function fetchMyFlashcards(): Promise<{ cards: Flashcard[] }> {
  return apiFetch("/api/retention/flashcards/manage");
}

export async function createFlashcard(input: FlashcardInput): Promise<{ card: Flashcard }> {
  return apiFetch("/api/retention/flashcards/manage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function updateFlashcard(
  flashcardId: string,
  input: Partial<FlashcardInput>,
): Promise<{ card: Flashcard }> {
  return apiFetch(`/api/retention/flashcards/manage/${flashcardId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function deleteFlashcard(flashcardId: string): Promise<{ ok: boolean }> {
  return apiFetch(`/api/retention/flashcards/manage/${flashcardId}`, { method: "DELETE" });
}

export async function fetchSprintQuestions(mode: "s3" | "s5" | "s10"): Promise<SprintData> {
  return apiFetch(`/api/retention/sprint?mode=${mode}`);
}

export async function submitSprint(
  answers: { questionId: string; selectedOption: string }[],
  mode: string,
): Promise<SprintResult> {
  return apiFetch("/api/retention/sprint", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers, mode }),
  });
}

export async function fetchMemoryRecovery(): Promise<{ items: MemoryRecoveryItem[] }> {
  return apiFetch("/api/retention/memory-recovery");
}
