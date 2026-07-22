import "server-only";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import {
  LEADERBOARD_REALTIME_CHANNEL as LEADERBOARD_CHANNEL_NAME,
  LEADERBOARD_REALTIME_EVENT as LEADERBOARD_EVENT_NAME,
  HOME_CONFIG_REALTIME_CHANNEL,
  HOME_CONFIG_REALTIME_EVENT,
  WEEKLY_CHALLENGE_REALTIME_CHANNEL,
  WEEKLY_CHALLENGE_REALTIME_EVENT,
} from "@/lib/realtime-constants";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const channels = new Map<string, RealtimeChannel>();
const subscribePromises = new Map<string, Promise<RealtimeChannel>>();

async function ensureChannel(name: string): Promise<RealtimeChannel> {
  const existing = channels.get(name);
  if (existing) {
    return existing;
  }

  const pending = subscribePromises.get(name);
  if (pending) {
    return pending;
  }

  const channel = supabase.channel(name);

  const subscribePromise = new Promise<RealtimeChannel>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Supabase realtime subscribe timeout"));
    }, 4000);

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        clearTimeout(timeout);
        channels.set(name, channel);
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
      subscribePromises.delete(name);
    });

  subscribePromises.set(name, subscribePromise);
  return subscribePromise;
}

async function broadcast(channelName: string, event: string, payload: object): Promise<void> {
  try {
    const channel = await ensureChannel(channelName);
    await channel.send({
      type: "broadcast",
      event,
      payload: {
        ...payload,
        emittedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.warn(`[Realtime] ${channelName}/${event} broadcast failed: ${message}`);
  }
}

export async function publishLeaderboardUpdatedEvent(payload: {
  userId: string;
  source: "LAB" | "KC" | "SIMULADO";
  gainedXp: number;
}) {
  await broadcast(LEADERBOARD_CHANNEL_NAME, LEADERBOARD_EVENT_NAME, payload);
}

export async function publishWeeklyChallengeUpdatedEvent(payload: {
  userId: string;
  score: number;
}) {
  await broadcast(WEEKLY_CHALLENGE_REALTIME_CHANNEL, WEEKLY_CHALLENGE_REALTIME_EVENT, payload);
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
