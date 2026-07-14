"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_ARENA_SCENARIO_ID } from "@/lib/arena-scenarios";

type ArenaBattleSession = { path: string } | null;

type ArenaBattleState = {
  session: ArenaBattleSession;
  scenarioId: string;
  startBattle: (path: string) => void;
  endBattle: () => void;
  setScenario: (id: string) => void;
};

// ponytail: no persistence for `session` — battle progress (remainingHp/streak) already lives in
// BossBattle server-side, so a reload just re-enters the same unfinished battle unlocked.
// `scenarioId` is the one field worth persisting: it's a cosmetic preference, not battle state.
export const useArenaBattleStore = create<ArenaBattleState>()(
  persist(
    (set) => ({
      session: null,
      scenarioId: DEFAULT_ARENA_SCENARIO_ID,
      startBattle: (path) => set({ session: { path } }),
      endBattle: () => set({ session: null }),
      setScenario: (id) => set({ scenarioId: id }),
    }),
    {
      name: "arena-scenario",
      partialize: (state) => ({ scenarioId: state.scenarioId }),
    },
  ),
);
