import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

const LEADERBOARD_CHANNEL_NAME = "leaderboard-updates";
const LEADERBOARD_EVENT_NAME = "xp-updated";

let leaderboardChannel: RealtimeChannel | null = null;
let subscribePromise: Promise<RealtimeChannel> | null = null;

async function ensureLeaderboardChannel(): Promise<RealtimeChannel> {
  if (leaderboardChannel) {
    return leaderboardChannel;
  }

  if (subscribePromise) {
    return subscribePromise;
  }

  const channel = supabase.channel(LEADERBOARD_CHANNEL_NAME);

  subscribePromise = new Promise<RealtimeChannel>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Supabase realtime subscribe timeout"));
    }, 4000);

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        clearTimeout(timeout);
        leaderboardChannel = channel;
        resolve(channel);
      }

      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        clearTimeout(timeout);
        reject(new Error(`Supabase realtime subscribe failure: ${status}`));
      }
    });
  })
    .catch((error) => {
      channel.unsubscribe();
      throw error;
    })
    .finally(() => {
      subscribePromise = null;
    });

  return subscribePromise;
}

export async function publishLeaderboardUpdatedEvent(payload: {
  userId: string;
  source: "LAB" | "KC" | "SIMULADO";
  gainedXp: number;
}) {
  try {
    const channel = await ensureLeaderboardChannel();
    await channel.send({
      type: "broadcast",
      event: LEADERBOARD_EVENT_NAME,
      payload: {
        ...payload,
        emittedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.warn(`[Realtime] leaderboard event failed: ${message}`);
  }
}

export const LEADERBOARD_REALTIME_CHANNEL = LEADERBOARD_CHANNEL_NAME;
export const LEADERBOARD_REALTIME_EVENT = LEADERBOARD_EVENT_NAME;
