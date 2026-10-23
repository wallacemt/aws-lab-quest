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
  startSession: (certificationCode: string, minutes?: number, config?: { timerMode?: SimulatedExamSession["timerMode"]; examStyle?: SimulatedExamSession["examStyle"] }) => void;
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
        const isExpired = !hasValidDates || (parsed.timerMode !== "COUNTUP_FREE" && parsed.timerMode !== "NONE" && !isPaused && endsAtMs <= Date.now());
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
  startSession: (certificationCode, minutes = 90, config = {}) => {
    const startedAt = new Date();
    const timerMode = config.timerMode ?? "COUNTDOWN_LOCK";
    const endsAt = new Date(startedAt.getTime() + (timerMode === "COUNTDOWN_LOCK" ? minutes * 60 * 1000 : 0));

    const nextSession: SimulatedExamSession = {
      id: `sim-${startedAt.getTime()}`,
      startedAt: startedAt.toISOString(),
      endsAt: endsAt.toISOString(),
      certificationCode,
      locked: true,
      timerMode,
      examStyle: config.examStyle ?? "EXAM",
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
    if (session.timerMode === "NONE") {
      const next: SimulatedExamSession = { ...session, pausedAt: new Date().toISOString(), pausedRemainingSeconds: 0 };
      persistSession(next);
      set({ session: next });
      return;
    }
    if (session.timerMode === "COUNTUP_FREE") {
      const next: SimulatedExamSession = { ...session, pausedAt: new Date().toISOString(), pausedRemainingSeconds: Math.max(0, Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000)) };
      persistSession(next);
      set({ session: next });
      return;
    }
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
    if (session.timerMode === "COUNTUP_FREE") {
      const startedAt = new Date(Date.now() - remaining * 1000).toISOString();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { pausedAt, pausedRemainingSeconds, ...rest } = session;
      const next: SimulatedExamSession = { ...rest, startedAt };
      persistSession(next);
      set({ session: next, nowMs: Date.now() });
      return;
    }
    if (session.timerMode === "NONE") {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { pausedAt, pausedRemainingSeconds, ...rest } = session;
      persistSession(rest);
      set({ session: rest, nowMs: Date.now() });
      return;
    }
    const newEndsAt = new Date(Date.now() + remaining * 1000).toISOString();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { pausedAt, pausedRemainingSeconds, ...rest } = session;
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
