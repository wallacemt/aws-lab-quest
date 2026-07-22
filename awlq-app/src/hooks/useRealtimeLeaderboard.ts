"use client";

import { useEffect } from "react";
import {
  LEADERBOARD_REALTIME_CHANNEL,
  LEADERBOARD_REALTIME_EVENT,
  WEEKLY_CHALLENGE_REALTIME_CHANNEL,
  WEEKLY_CHALLENGE_REALTIME_EVENT,
} from "@/lib/realtime-constants";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export function useRealtimeChannel(channel: string, event: string, onUpdated: () => void) {
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return;
    }

    const ch = supabase
      .channel(channel)
      .on("broadcast", { event }, () => {
        onUpdated();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(ch);
    };
  }, [channel, event, onUpdated]);
}

export function useRealtimeLeaderboard(onUpdated: () => void) {
  useRealtimeChannel(LEADERBOARD_REALTIME_CHANNEL, LEADERBOARD_REALTIME_EVENT, onUpdated);
}

export function useRealtimeWeeklyChallenge(onUpdated: () => void) {
  useRealtimeChannel(WEEKLY_CHALLENGE_REALTIME_CHANNEL, WEEKLY_CHALLENGE_REALTIME_EVENT, onUpdated);
}
