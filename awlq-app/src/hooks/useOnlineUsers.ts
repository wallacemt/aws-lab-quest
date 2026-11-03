"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

type OnlineCountResponse = {
  onlineCount?: number;
  error?: string;
};

async function postHeartbeat() {
  await fetch("/api/online/heartbeat", {
    method: "POST",
    credentials: "include",
  });
}

async function postGuestHeartbeat() {
  await fetch("/api/online/guest-heartbeat", { method: "POST", credentials: "include" });
}

async function fetchOnlineCount(): Promise<number> {
  const response = await fetch("/api/online/count", {
    method: "GET",
    cache: "no-store",
    credentials: "include",
  });

  const data = (await response.json()) as OnlineCountResponse;
  if (!response.ok || data.error) {
    return 0;
  }

  return Math.max(0, Number(data.onlineCount ?? 0));
}

export function useOnlineUsers() {
  const [onlineCount, setOnlineCount] = useState(0);
  const { isAuthenticated, isPending } = useAuth();
  const heartbeat = isAuthenticated ? postHeartbeat : postGuestHeartbeat;

  const refresh = useCallback(async () => {
    try {
      if (!isPending) await heartbeat();
      const count = await fetchOnlineCount();
      setOnlineCount(count);
    } catch {
      // ignore transient errors
    }
  }, [heartbeat, isPending]);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => {
      void refresh();
    }, 0);

    const heartbeatInterval = window.setInterval(() => {
      if (!isPending) void heartbeat();
    }, 60 * 1000);

    const refreshInterval = window.setInterval(() => {
      void refresh();
    }, 20 * 1000);

    const onFocus = () => {
      void refresh();
    };

    window.addEventListener("focus", onFocus);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(heartbeatInterval);
      window.clearInterval(refreshInterval);
      window.removeEventListener("focus", onFocus);
    };
  }, [heartbeat, isPending, refresh]);

  return {
    onlineCount,
  };
}
