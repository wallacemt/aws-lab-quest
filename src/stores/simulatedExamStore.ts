"use client";

import { create } from "zustand";
import { STORAGE_KEYS } from "@/lib/storage";
import { SimulatedExamSession } from "@/lib/types";

type SimulatedExamState = {
  session: SimulatedExamSession | null;
  hydrated: boolean;
  nowMs: number;
  hydrate: () => void;
  setNowMs: (value: number) => void;
  startSession: (certificationCode: string, minutes?: number) => void;
  submitSession: () => void;
  clearSession: () => void;
};

function persistSession(next: SimulatedExamSession | null) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEYS.activeSimulatedExam, JSON.stringify(next));
}

export const useSimulatedExamStore = create<SimulatedExamState>((set, get) => ({
  session: null,
  hydrated: false,
  nowMs: 0,
  hydrate: () => {
    if (get().hydrated || typeof window === "undefined") {
      return;
    }

    let parsed: SimulatedExamSession | null = null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.activeSimulatedExam);
      parsed = raw ? (JSON.parse(raw) as SimulatedExamSession | null) : null;
    } catch {
      parsed = null;
    }

    set({ session: parsed, hydrated: true, nowMs: Date.now() });
  },
  setNowMs: (value) => set({ nowMs: value }),
  startSession: (certificationCode, minutes = 90) => {
    const startedAt = new Date();
    const endsAt = new Date(startedAt.getTime() + minutes * 60 * 1000);

    const nextSession: SimulatedExamSession = {
      id: `sim-${startedAt.getTime()}`,
      startedAt: startedAt.toISOString(),
      endsAt: endsAt.toISOString(),
      certificationCode,
      locked: true,
    };

    persistSession(nextSession);
    set({ session: nextSession, nowMs: Date.now() });
  },
  submitSession: () => {
    persistSession(null);
    set({ session: null, nowMs: 0 });
  },
  clearSession: () => {
    persistSession(null);
    set({ session: null, nowMs: 0 });
  },
}));
