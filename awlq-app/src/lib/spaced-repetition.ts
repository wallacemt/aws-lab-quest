/**
 * Pure SM-2 implementation (ADR-01).
 * No I/O — only scheduling math. Isolated so a future swap to FSRS touches only this module.
 *
 * Grade mapping (4-button scale → SM-2 q-value):
 *   VERY_HARD → q=0 (complete blackout)
 *   HARD      → q=3 (correct but with difficulty)
 *   GOOD      → q=4 (correct, some hesitation)
 *   EASY      → q=5 (correct, effortless)
 */

export type Sm2State = {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
};

export type Sm2Grade = "VERY_HARD" | "HARD" | "GOOD" | "EASY";

export type Sm2Result = Sm2State & { dueAt: Date };

const MIN_EASE_FACTOR = 1.3;

function addDays(base: Date, days: number): Date {
  const result = new Date(base);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Returns the effective interval when a target exam date is set.
 * As the exam approaches, intervals compress so reviews are more frequent (RNF-08).
 */
function applyExamDateCompression(intervalDays: number, targetExamDate?: Date): number {
  if (!targetExamDate) return intervalDays;

  const now = new Date();
  const daysUntilExam = Math.floor((targetExamDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

  if (daysUntilExam <= 0) return intervalDays;

  // Only compress when the exam is closer than the computed interval.
  if (daysUntilExam >= intervalDays) return intervalDays;

  return Math.min(intervalDays, Math.max(1, Math.floor(daysUntilExam / 2)));
}

/**
 * Computes the next SM-2 state given the current card state and the grade received.
 *
 * @param state - Current SM-2 state of the card.
 * @param grade - The grade the user gave this card.
 * @param targetExamDate - Optional; when set, intervals compress as the date approaches.
 * @returns The updated SM-2 state plus the absolute `dueAt` timestamp.
 */
export function computeNextReview(state: Sm2State, grade: Sm2Grade, targetExamDate?: Date): Sm2Result {
  const now = new Date();
  let { easeFactor, intervalDays, repetitions } = state;

  switch (grade) {
    case "VERY_HARD": {
      // Total blackout — reset to beginning, penalize ease.
      repetitions = 0;
      intervalDays = 1;
      easeFactor = Math.max(MIN_EASE_FACTOR, easeFactor - 0.8);
      break;
    }

    case "HARD": {
      // Incorrect or barely correct — reset repetitions, penalize ease lightly.
      repetitions = 0;
      intervalDays = 1;
      easeFactor = Math.max(MIN_EASE_FACTOR, easeFactor - 0.15);
      break;
    }

    case "GOOD": {
      // Correct with hesitation — advance schedule, slight ease boost.
      repetitions += 1;
      intervalDays = nextInterval(repetitions, intervalDays, easeFactor);
      easeFactor = easeFactor + 0.1;
      break;
    }

    case "EASY": {
      // Effortless correct — advance schedule, larger ease boost.
      repetitions += 1;
      intervalDays = nextInterval(repetitions, intervalDays, easeFactor);
      easeFactor = easeFactor + 0.15;
      break;
    }
  }

  const effectiveInterval = applyExamDateCompression(intervalDays, targetExamDate);
  const dueAt = addDays(now, effectiveInterval);

  return { easeFactor, intervalDays, repetitions, dueAt };
}

/** SM-2 interval progression: 1 → 6 → round(prev * ef) */
function nextInterval(repetitions: number, prevInterval: number, easeFactor: number): number {
  if (repetitions === 1) return 1;
  if (repetitions === 2) return 6;
  return Math.round(prevInterval * easeFactor);
}
