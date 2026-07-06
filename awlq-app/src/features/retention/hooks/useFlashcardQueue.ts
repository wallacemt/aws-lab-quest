"use client";

import { useState, useCallback } from "react";
import {
  Flashcard,
  FlashcardGrade,
  fetchDueFlashcards,
  submitFlashcardGrades,
} from "@/features/retention/services/retention-api";

type GradeItem = { flashcardId: string; grade: FlashcardGrade };

type UseFlashcardQueueState = {
  cards: Flashcard[];
  currentIndex: number;
  dueTotal: number;
  pendingGrades: GradeItem[];
  isLoading: boolean;
  isSubmitting: boolean;
  isDone: boolean;
  error: string | null;
};

type UseFlashcardQueueActions = {
  load: () => Promise<void>;
  gradeCard: (grade: FlashcardGrade) => void;
  goNext: () => Promise<void>;
  goPrev: () => void;
};

/**
 * Replaces (or appends) the grade for a given card, keeping at most one
 * pending grade per flashcard so re-grading never duplicates entries.
 * Exported standalone because it's pure — no need to mount the hook to test it.
 */
export function upsertGrade(grades: GradeItem[], flashcardId: string, grade: FlashcardGrade): GradeItem[] {
  const existingIndex = grades.findIndex((item) => item.flashcardId === flashcardId);
  if (existingIndex === -1) return [...grades, { flashcardId, grade }];
  const next = [...grades];
  next[existingIndex] = { flashcardId, grade };
  return next;
}

/**
 * Manages the flashcard review queue.
 * Grading only records a grade for the current card — it never advances the
 * queue. Navigation is explicit via goNext/goPrev. Grades are batched locally
 * and submitted when the user advances past the last card (RNF-07).
 */
export function useFlashcardQueue(): UseFlashcardQueueState & UseFlashcardQueueActions {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dueTotal, setDueTotal] = useState(0);
  const [pendingGrades, setPendingGrades] = useState<GradeItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setIsDone(false);
    setCurrentIndex(0);
    setPendingGrades([]);
    try {
      const data = await fetchDueFlashcards();
      setCards(data.cards);
      setDueTotal(data.dueTotal);
      if (data.cards.length === 0) setIsDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar flashcards.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const gradeCard = useCallback(
    (grade: FlashcardGrade) => {
      const card = cards[currentIndex];
      if (!card) return;
      setPendingGrades((prev) => upsertGrade(prev, card.id, grade));
    },
    [cards, currentIndex],
  );

  const goPrev = useCallback(() => {
    setCurrentIndex((index) => Math.max(0, index - 1));
  }, []);

  const goNext = useCallback(async () => {
    const isLastCard = currentIndex >= cards.length - 1;
    if (!isLastCard) {
      setCurrentIndex((index) => index + 1);
      return;
    }

    if (pendingGrades.length > 0) {
      setIsSubmitting(true);
      try {
        await submitFlashcardGrades(pendingGrades);
        setPendingGrades([]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao enviar avaliações.");
      } finally {
        setIsSubmitting(false);
      }
    }
    setIsDone(true);
  }, [currentIndex, cards.length, pendingGrades]);

  return {
    cards,
    currentIndex,
    dueTotal,
    pendingGrades,
    isLoading,
    isSubmitting,
    isDone,
    error,
    load,
    gradeCard,
    goNext,
    goPrev,
  };
}
