import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";

/**
 * Fixed-window rate limiter backed by Redis (INCR + EXPIRE).
 * Fails open (returns null / allows the request) when Redis isn't configured
 * or is unreachable — this is defense-in-depth on top of session auth and
 * per-route business limits, not the sole line of defense.
 */
export async function checkRateLimit(
  identifier: string,
  routeName: string,
  limit: number,
  windowSeconds: number,
): Promise<NextResponse | null> {
  if (!redis) return null;

  const key = `ratelimit:${routeName}:${identifier}`;
  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, windowSeconds);
    }
    if (count > limit) {
      return NextResponse.json(
        { error: "Muitas requisicoes. Aguarde um momento e tente novamente." },
        { status: 429 },
      );
    }
    return null;
  } catch (err) {
    console.error("[rate-limit] error:", err);
    return null;
  }
}
