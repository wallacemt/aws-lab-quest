"use client";

import { useState, useCallback } from "react";
import {
  DailyReviewData,
  MemoryRecoveryItem,
  fetchDailyReview,
  fetchMemoryRecovery,
} from "@/features/retention/services/retention-api";

type UseDailyReviewState = {
  data: DailyReviewData | null;
  recoveryItems: MemoryRecoveryItem[];
  isLoading: boolean;
  error: string | null;
};

type UseDailyReviewActions = {
  load: () => Promise<void>;
};

export function useDailyReview(): UseDailyReviewState & UseDailyReviewActions {
  const [data, setData] = useState<DailyReviewData | null>(null);
  const [recoveryItems, setRecoveryItems] = useState<MemoryRecoveryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
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

  return { data, recoveryItems, isLoading, error, load };
}
