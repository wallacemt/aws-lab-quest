"use client";

import { create } from "zustand";
import { STORAGE_KEYS } from "@/lib/storage";
import { SimulatedExamSession } from "@/lib/types";

type SimulatedExamState = {
  session: SimulatedExamSession | null;
  hydrated: boolean;
  restoredFromStorage: boolean;
  nowMs: number;
  hydrate: () => void;
  setNowMs: (value: number) => void;
  startSession: (certificationCode: string, minutes?: number) => void;
  submitSession: () => void;
  clearSession: () => void;
  acknowledgeRestoredSession: () => void;
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
  restoredFromStorage: false,
  nowMs: 0,
  hydrate: () => {
    if (get().hydrated || typeof window === "undefined") {
      return;
    }

    let parsed: SimulatedExamSession | null = null;
    let restoredFromStorage = false;

    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.activeSimulatedExam);
      parsed = raw ? (JSON.parse(raw) as SimulatedExamSession | null) : null;

      if (parsed) {
        const endsAtMs = new Date(parsed.endsAt).getTime();
        const startedAtMs = new Date(parsed.startedAt).getTime();
        const hasValidDates = Number.isFinite(endsAtMs) && Number.isFinite(startedAtMs);
        const isExpired = !hasValidDates || endsAtMs <= Date.now();
        const isSubmitted = Boolean(parsed.submittedAt);

        if (isExpired || isSubmitted) {
          parsed = null;
          window.localStorage.removeItem(STORAGE_KEYS.activeSimulatedExam);
        } else {
          restoredFromStorage = true;
        }
      }
    } catch {
      parsed = null;
      window.localStorage.removeItem(STORAGE_KEYS.activeSimulatedExam);
    }

    set({ session: parsed, hydrated: true, restoredFromStorage, nowMs: Date.now() });
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
    set({ session: nextSession, restoredFromStorage: false, nowMs: Date.now() });
  },
  submitSession: () => {
    persistSession(null);
    set({ session: null, restoredFromStorage: false, nowMs: 0 });
  },
  clearSession: () => {
    persistSession(null);
    set({ session: null, restoredFromStorage: false, nowMs: 0 });
  },
  acknowledgeRestoredSession: () => {
    if (!get().restoredFromStorage) {
      return;
    }

    set({ restoredFromStorage: false });
  },
}));
