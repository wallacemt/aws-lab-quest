"use client";

import { useState, useCallback } from "react";
import {
  DailyReviewData,
  MemoryRecoveryItem,
  completeDailyReview,
  fetchDailyReview,
  fetchMemoryRecovery,
} from "@/features/retention/services/retention-api";

type UseDailyReviewState = {
  data: DailyReviewData | null;
  recoveryItems: MemoryRecoveryItem[];
  streakDays: number | null;
  isLoading: boolean;
  isCompleting: boolean;
  error: string | null;
};

type UseDailyReviewActions = {
  load: () => Promise<void>;
  /** Call when the user has finished reviewing all due items. Increments streak. */
  complete: () => Promise<void>;
};

export function useDailyReview(): UseDailyReviewState & UseDailyReviewActions {
  const [data, setData] = useState<DailyReviewData | null>(null);
  const [recoveryItems, setRecoveryItems] = useState<MemoryRecoveryItem[]>([]);
  const [streakDays, setStreakDays] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [reviewData, recoveryData] = await Promise.all([
        fetchDailyReview(),
        fetchMemoryRecovery(),
      ]);
      setData(reviewData);
      setRecoveryItems(recoveryData.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar revisão diária.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Signals review completion to the server (DEF-004 fix).
   * The server increments the streak idempotently — safe to call multiple times.
   */
  const complete = useCallback(async () => {
    if (isCompleting) return;
    setIsCompleting(true);
    try {
      const result = await completeDailyReview();
      setStreakDays(result.streakDays);
    } catch {
      // Streak failure is non-critical — do not block the user.
    } finally {
      setIsCompleting(false);
    }
  }, [isCompleting]);

  return { data, recoveryItems, streakDays, isLoading, isCompleting, error, load, complete };
}
