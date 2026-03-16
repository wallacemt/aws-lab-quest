"use client";

import { create } from "zustand";
import { getTaskXpByDifficulty } from "@/lib/levels";
import { STORAGE_KEYS } from "@/lib/storage";
import { ActiveQuest, Task, UserProfile } from "@/lib/types";

function taskDifficulty(task: Task) {
  return task.difficulty ?? "medium";
}

type QuestState = {
  activeQuest: ActiveQuest | null;
  hydrated: boolean;
  hydrate: () => void;
  startQuest: (params: { title: string; theme: string; sourceLabText: string; tasks: Task[] }) => void;
  toggleTask: (taskId: number, checked: boolean) => void;
  finishQuest: (profile: UserProfile) => void;
  clearActiveQuest: () => void;
};

function persistActiveQuest(next: ActiveQuest | null) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEYS.activeQuest, JSON.stringify(next));
}

export const useQuestStore = create<QuestState>((set, get) => ({
  activeQuest: null,
  hydrated: false,
  hydrate: () => {
    if (get().hydrated || typeof window === "undefined") {
      return;
    }

    let parsed: ActiveQuest | null = null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.activeQuest);
      parsed = raw ? (JSON.parse(raw) as ActiveQuest | null) : null;
    } catch {
      parsed = null;
    }

    set({ activeQuest: parsed, hydrated: true });
  },
  startQuest: (params) => {
    const normalizedTasks = params.tasks.map((task) => ({ ...task, difficulty: taskDifficulty(task) }));

    const nextQuest: ActiveQuest = {
      title: params.title,
      theme: params.theme,
      sourceLabText: params.sourceLabText,
      tasks: normalizedTasks,
      xp: 0,
      startedAt: new Date().toISOString(),
      completed: false,
    };

    persistActiveQuest(nextQuest);
    set({ activeQuest: nextQuest });
  },
  toggleTask: (taskId, checked) => {
    const current = get().activeQuest;
    if (!current) {
      return;
    }

    const tasks = current.tasks.map((task) =>
      task.id === taskId ? { ...task, completed: checked, difficulty: taskDifficulty(task) } : task,
    );

    const newXP = tasks
      .filter((task) => task.completed)
      .reduce((sum, task) => sum + getTaskXpByDifficulty(taskDifficulty(task)), 0);

    const nextQuest: ActiveQuest = {
      ...current,
      tasks,
      xp: newXP,
      completed: current.completed,
    };

    persistActiveQuest(nextQuest);
    set({ activeQuest: nextQuest });
  },
  finishQuest: (profile) => {
    const current = get().activeQuest;
    if (!current || current.completed) {
      return;
    }

    const nextQuest: ActiveQuest = {
      ...current,
      completed: true,
    };

    persistActiveQuest(nextQuest);
    set({ activeQuest: nextQuest });

    fetch("/api/quest-history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: current.title,
        theme: current.theme,
        xp: current.xp,
        tasksCount: current.tasks.length,
        taskSnapshot: current.tasks,
        sourceLabText: current.sourceLabText ?? "",
        completedAt: new Date().toISOString(),
        certification: profile.certification,
        userName: profile.name,
      }),
    }).catch(console.error);
  },
  clearActiveQuest: () => {
    persistActiveQuest(null);
    set({ activeQuest: null });
  },
}));
