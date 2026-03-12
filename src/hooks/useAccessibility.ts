"use client";

import { useEffect } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";

const STORAGE_KEY = "awlq_font_scale";
const MIN_FONT_SCALE = 0.9;
const MAX_FONT_SCALE = 1.4;
const FONT_SCALE_STEP = 0.1;

export function useAccessibility() {
  const { value: fontScale, setValue: setFontScale, hydrated } = useLocalStorage<number>(STORAGE_KEY, 1);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    const clamped = Math.max(MIN_FONT_SCALE, Math.min(MAX_FONT_SCALE, fontScale));
    document.documentElement.style.setProperty("--app-font-scale", clamped.toFixed(2));
  }, [fontScale, hydrated]);

  function increaseFontSize() {
    setFontScale((prev) => Math.min(MAX_FONT_SCALE, Number((prev + FONT_SCALE_STEP).toFixed(2))));
  }

  function decreaseFontSize() {
    setFontScale((prev) => Math.max(MIN_FONT_SCALE, Number((prev - FONT_SCALE_STEP).toFixed(2))));
  }

  function resetFontSize() {
    setFontScale(1);
  }

  return {
    fontScale,
    hydrated,
    canIncrease: fontScale < MAX_FONT_SCALE,
    canDecrease: fontScale > MIN_FONT_SCALE,
    increaseFontSize,
    decreaseFontSize,
    resetFontSize,
  };
}
