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
  gradeCard: (grade: FlashcardGrade) => Promise<void>;
  flushGrades: () => Promise<void>;
};

/**
 * Manages the flashcard review queue.
 * Grades are batched locally and submitted when the queue is empty (RNF-07).
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

  const flushGrades = useCallback(async () => {
    if (pendingGrades.length === 0) return;
    setIsSubmitting(true);
    try {
      await submitFlashcardGrades(pendingGrades);
      setPendingGrades([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar avaliações.");
    } finally {
      setIsSubmitting(false);
    }
  }, [pendingGrades]);

  const gradeCard = useCallback(
    async (grade: FlashcardGrade) => {
      const card = cards[currentIndex];
      if (!card) return;

      const newGrades = [...pendingGrades, { flashcardId: card.id, grade }];
      setPendingGrades(newGrades);

      const nextIndex = currentIndex + 1;
      const isLastCard = nextIndex >= cards.length;

      setCurrentIndex(nextIndex);

      if (isLastCard) {
        // Flush all grades when the deck is exhausted (batch submit for RNF-07).
        setIsSubmitting(true);
        try {
          await submitFlashcardGrades(newGrades);
          setPendingGrades([]);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Erro ao enviar avaliações.");
        } finally {
          setIsSubmitting(false);
          setIsDone(true);
        }
      }
    },
    [cards, currentIndex, pendingGrades],
  );

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
    flushGrades,
  };
}
