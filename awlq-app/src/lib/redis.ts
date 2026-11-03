import Redis from "ioredis";

const globalForRedis = globalThis as unknown as { _redis: Redis | null };

function createRedisClient(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;

  const client = new Redis(url, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 3_000,
  });

  client.on("error", (err: Error) => {
    console.error("[redis] error:", err.message);
  });

  return client;
}

export const redis = globalForRedis._redis ?? createRedisClient();

export async function scanKeys(pattern: string): Promise<string[]> {
  if (!redis) return [];
  try {
    const keys: string[] = [];
    let cursor = "0";
    do {
      const [nextCursor, batch] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
      cursor = nextCursor;
      keys.push(...batch);
    } while (cursor !== "0");
    return keys;
  } catch {
    return [];
  }
}

if (process.env.NODE_ENV !== "production") {
  globalForRedis._redis = redis;
}
