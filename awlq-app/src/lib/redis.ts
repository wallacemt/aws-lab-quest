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

if (process.env.NODE_ENV !== "production") {
  globalForRedis._redis = redis;
}
