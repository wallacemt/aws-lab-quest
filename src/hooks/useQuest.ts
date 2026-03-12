"use client";

import { useMemo } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { XP_PER_TASK } from "@/lib/levels";
import { STORAGE_KEYS } from "@/lib/storage";
import { ActiveQuest, Task, UserProfile } from "@/lib/types";

export function useQuest() {
  const active = useLocalStorage<ActiveQuest | null>(STORAGE_KEYS.activeQuest, null);

  const completedCount = useMemo(() => {
    return active.value?.tasks.filter((task) => task.completed).length ?? 0;
  }, [active.value]);

  const totalCount = active.value?.tasks.length ?? 0;
  const xp = active.value?.xp ?? 0;

  function startQuest(params: { title: string; theme: string; tasks: Task[] }) {
    active.setValue({
      title: params.title,
      theme: params.theme,
      tasks: params.tasks,
      xp: 0,
      startedAt: new Date().toISOString(),
      completed: false,
    });
  }

  function toggleTask(taskId: number, checked: boolean) {
    if (!active.value) return;

    const tasks = active.value.tasks.map((task) => (task.id === taskId ? { ...task, completed: checked } : task));

    const newXP = tasks.filter((t) => t.completed).length * XP_PER_TASK;

    active.setValue({
      ...active.value,
      tasks,
      xp: newXP,
      completed: active.value.completed,
    });
  }

  function finishQuest(profile: UserProfile) {
    if (!active.value || active.value.completed) return;

    // Mark completed in localStorage
    active.setValue({ ...active.value, completed: true });

    // Persist to database (fire-and-forget)
    fetch("/api/quest-history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: active.value.title,
        theme: active.value.theme,
        xp: active.value.xp,
        tasksCount: active.value.tasks.length,
        completedAt: new Date().toISOString(),
        certification: profile.certification,
        userName: profile.name,
      }),
    }).catch(console.error);
  }

  function clearActiveQuest() {
    active.setValue(null);
  }

  return {
    activeQuest: active.value,
    hydrated: active.hydrated,
    xp,
    completedCount,
    totalCount,
    startQuest,
    toggleTask,
    finishQuest,
    clearActiveQuest,
  };
}
