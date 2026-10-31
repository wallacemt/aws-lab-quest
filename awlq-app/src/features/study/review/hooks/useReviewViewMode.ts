"use client";

import { useCallback, useState } from "react";
import { STORAGE_KEYS, safeLocalStorageGet, safeLocalStorageSet } from "@/lib/storage";
import type { ReviewSession } from "../types";

export function useReviewViewMode(kind: ReviewSession["kind"]): ["simple" | "metrics", (mode: "simple" | "metrics") => void] {
  const [mode, setModeState] = useState<"simple" | "metrics">(() => {
    if (kind !== "SIMULADO") return "simple";
    const saved = safeLocalStorageGet<unknown>(STORAGE_KEYS.reviewViewMode, "simple");
    return saved === "metrics" ? "metrics" : "simple";
  });
  const setMode = useCallback((next: "simple" | "metrics") => {
    if (kind !== "SIMULADO") return;
    setModeState(next);
    safeLocalStorageSet(STORAGE_KEYS.reviewViewMode, next);
  }, [kind]);
  return [kind === "SIMULADO" ? mode : "simple", setMode];
}
