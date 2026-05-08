"use client";

import { useCallback, useEffect, useState } from "react";

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

  const refresh = useCallback(async () => {
    try {
      await postHeartbeat();
      const count = await fetchOnlineCount();
      setOnlineCount(count);
    } catch {
      // ignore transient errors
    }
  }, []);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => {
      void refresh();
    }, 0);

    const heartbeatInterval = window.setInterval(() => {
      void postHeartbeat();
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
  }, [refresh]);

  return {
    onlineCount,
  };
}
