import "server-only";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import {
  LEADERBOARD_REALTIME_CHANNEL as LEADERBOARD_CHANNEL_NAME,
  LEADERBOARD_REALTIME_EVENT as LEADERBOARD_EVENT_NAME,
  HOME_CONFIG_REALTIME_CHANNEL,
  HOME_CONFIG_REALTIME_EVENT,
} from "@/lib/realtime-constants";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

// REST broadcast — no WebSocket subscription needed on the server side.
export async function publishHomeConfigUpdatedEvent() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return;
  try {
    const res = await fetch(`${SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
        "apikey": SUPABASE_SERVICE_KEY,
      },
      body: JSON.stringify({
        messages: [{
          topic: `realtime:${HOME_CONFIG_REALTIME_CHANNEL}`,
          event: "broadcast",
          payload: { type: "broadcast", event: HOME_CONFIG_REALTIME_EVENT, payload: {} },
        }],
      }),
    });
    if (!res.ok) console.warn("[Realtime] home-config broadcast HTTP", res.status, await res.text());
  } catch (err) {
    console.warn("[Realtime] home-config broadcast failed:", err instanceof Error ? err.message : err);
  }
}

export { LEADERBOARD_REALTIME_CHANNEL, LEADERBOARD_REALTIME_EVENT } from "@/lib/realtime-constants";
