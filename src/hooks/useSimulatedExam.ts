"use client";

import { useEffect, useMemo } from "react";
import { useSimulatedExamStore } from "@/stores/simulatedExamStore";

let tickerId: number | null = null;
let tickerSubscribers = 0;

export function useSimulatedExam() {
  const { hydrated, session, nowMs, hydrate, setNowMs, startSession, submitSession, clearSession } =
    useSimulatedExamStore();

  useEffect(() => {
    if (!hydrated) {
      hydrate();
    }
  }, [hydrate, hydrated]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    tickerSubscribers += 1;

    if (tickerId == null) {
      tickerId = window.setInterval(() => setNowMs(Date.now()), 1000);
    }

    return () => {
      tickerSubscribers = Math.max(0, tickerSubscribers - 1);
      if (tickerSubscribers === 0 && tickerId != null) {
        window.clearInterval(tickerId);
        tickerId = null;
      }
    };
  }, [hydrated, setNowMs]);

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

  return {
    hydrated,
    session,
    isActive,
    remainingSeconds,
    startSession,
    submitSession,
    clearSession,
  };
}
