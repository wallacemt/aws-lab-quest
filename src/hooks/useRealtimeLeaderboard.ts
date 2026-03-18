"use client";

import { useEffect } from "react";
import { LEADERBOARD_REALTIME_CHANNEL, LEADERBOARD_REALTIME_EVENT } from "@/lib/realtime-events";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export function useRealtimeLeaderboard(onUpdated: () => void) {
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return;
    }

    const channel = supabase
      .channel(LEADERBOARD_REALTIME_CHANNEL)
      .on("broadcast", { event: LEADERBOARD_REALTIME_EVENT }, () => {
        onUpdated();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [onUpdated]);
}
