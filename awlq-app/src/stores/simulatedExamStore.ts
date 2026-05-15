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
  pauseSession: () => void;
  resumeSession: () => void;
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
        const isPaused = Boolean(parsed.pausedAt) && (parsed.pausedRemainingSeconds ?? 0) > 0;
        const isExpired = !hasValidDates || (!isPaused && endsAtMs <= Date.now());
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
  pauseSession: () => {
    const { session } = get();
    if (!session || session.pausedAt || session.submittedAt) return;
    const endsAtMs = new Date(session.endsAt).getTime();
    const pausedRemainingSeconds = Math.max(0, Math.floor((endsAtMs - Date.now()) / 1000));
    const next: SimulatedExamSession = { ...session, pausedAt: new Date().toISOString(), pausedRemainingSeconds };
    persistSession(next);
    set({ session: next });
  },
  resumeSession: () => {
    const { session } = get();
    if (!session || !session.pausedAt) return;
    const remaining = session.pausedRemainingSeconds ?? 0;
    const newEndsAt = new Date(Date.now() + remaining * 1000).toISOString();
    const { pausedAt: _pausedAt, pausedRemainingSeconds: _pausedRemaining, ...rest } = session;
    const next: SimulatedExamSession = { ...rest, endsAt: newEndsAt };
    persistSession(next);
    set({ session: next, nowMs: Date.now() });
  },
  acknowledgeRestoredSession: () => {
    if (!get().restoredFromStorage) {
      return;
    }

    set({ restoredFromStorage: false });
  },
}));
