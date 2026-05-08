"use client";

import { useEffect, useMemo } from "react";
import { useQuestStore } from "@/stores/questStore";

export function useQuest() {
  const { activeQuest, hydrated, hydrate, startQuest, toggleTask, finishQuest, clearActiveQuest } = useQuestStore();

  useEffect(() => {
    if (!hydrated) {
      hydrate();
    }
  }, [hydrate, hydrated]);

  const completedCount = useMemo(() => {
    return activeQuest?.tasks.filter((task) => task.completed).length ?? 0;
  }, [activeQuest]);

  const totalCount = activeQuest?.tasks.length ?? 0;
  const xp = activeQuest?.xp ?? 0;

  return {
    activeQuest,
    hydrated,
    xp,
    completedCount,
    totalCount,
    startQuest,
    toggleTask,
    finishQuest,
    clearActiveQuest,
  };
}
