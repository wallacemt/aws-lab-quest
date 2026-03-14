"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { STORAGE_KEYS } from "@/lib/storage";
import { SimulatedExamSession } from "@/lib/types";

export function useSimulatedExam() {
  const storage = useLocalStorage<SimulatedExamSession | null>(STORAGE_KEYS.activeSimulatedExam, null);
  const session = storage.value;
  const [nowMs, setNowMs] = useState<number>(0);

  useEffect(() => {
    if (!storage.hydrated) return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [storage.hydrated]);

  const remainingSeconds = useMemo(() => {
    if (!session) return 0;
    if (nowMs === 0) {
      const startedAtMs = new Date(session.startedAt).getTime();
      const endsAtMs = new Date(session.endsAt).getTime();
      return Math.max(0, Math.floor((endsAtMs - startedAtMs) / 1000));
    }
    const endsAtMs = new Date(session.endsAt).getTime();
    return Math.max(0, Math.floor((endsAtMs - nowMs) / 1000));
  }, [nowMs, session]);

  const isActive = Boolean(session && !session.submittedAt && remainingSeconds > 0);

  function startSession(certificationCode: string, minutes = 90) {
    const startedAt = new Date();
    const endsAt = new Date(startedAt.getTime() + minutes * 60 * 1000);
    const nextSession: SimulatedExamSession = {
      id: `sim-${startedAt.getTime()}`,
      startedAt: startedAt.toISOString(),
      endsAt: endsAt.toISOString(),
      certificationCode,
      locked: true,
    };

    storage.setValue(nextSession);
  }

  function submitSession() {
    if (!session) return;
    storage.setValue(null);
    setNowMs(0);
  }

  function clearSession() {
    storage.setValue(null);
    setNowMs(0);
  }

  return {
    hydrated: storage.hydrated,
    session,
    isActive,
    remainingSeconds,
    startSession,
    submitSession,
    clearSession,
  };
}
