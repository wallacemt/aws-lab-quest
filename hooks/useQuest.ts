"use client";

import { useMemo } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { XP_PER_TASK } from "@/lib/levels";
import { STORAGE_KEYS } from "@/lib/storage";
import { ActiveQuest, QuestHistoryItem, Task, UserProfile } from "@/lib/types";

const emptyHistory: QuestHistoryItem[] = [];

export function useQuest() {
  const active = useLocalStorage<ActiveQuest | null>(STORAGE_KEYS.activeQuest, null);
  const history = useLocalStorage<QuestHistoryItem[]>(STORAGE_KEYS.history, emptyHistory);

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
    if (!active.value) {
      return;
    }

    const tasks = active.value.tasks.map((task) => (task.id === taskId ? { ...task, completed: checked } : task));

    const newXP = tasks.filter((task) => task.completed).length * XP_PER_TASK;

    active.setValue({
      ...active.value,
      tasks,
      xp: newXP,
      // Historico e estado final sao confirmados apenas em finishQuest.
      completed: active.value.completed,
    });
  }

  function finishQuest(profile: UserProfile) {
    if (!active.value || active.value.completed) {
      return;
    }

    const item: QuestHistoryItem = {
      id: crypto.randomUUID(),
      title: active.value.title,
      theme: active.value.theme,
      xp: active.value.xp,
      tasksCount: active.value.tasks.length,
      completedAt: new Date().toISOString(),
      certification: profile.certification,
      userName: profile.name,
    };

    const nextHistory = [item, ...history.value].slice(0, 10);
    history.setValue(nextHistory);
    active.setValue({ ...active.value, completed: true });
  }

  function clearActiveQuest() {
    active.setValue(null);
  }

  return {
    activeQuest: active.value,
    history: history.value,
    hydrated: active.hydrated && history.hydrated,
    xp,
    completedCount,
    totalCount,
    startQuest,
    toggleTask,
    finishQuest,
    clearActiveQuest,
  };
}
