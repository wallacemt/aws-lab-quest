import { redis } from "./redis";

export const CACHE_TTL = {
  CERTIFICATIONS: 3_600,
  SERVICES_LIST: 3_600,
  SERVICES_COUNT: 300,
  LEADERBOARD: 300,
  BADGES_LIST: 3_600,
  USER_PUBLIC_PROFILE: 300,
  USER_PROFILE: 600,
  USER_HISTORY: 300,
  USER_ACHIEVEMENTS: 300,
} as const;

export const CACHE_KEYS = {
  certifications:    (): string => "global:certifications",
  servicesList:      (): string => "global:services",
  servicesWithCount: (certId: string, diff: string | null): string =>
    `services:count:${certId}:${diff ?? "all"}`,
  leaderboard:       (): string => "global:leaderboard",
  badgesList:        (): string => "global:badges",
  userPublicProfile: (userId: string): string => `user:public:${userId}`,
  userProfile:       (userId: string): string => `user:profile:${userId}`,
  userQuestHistory:  (userId: string): string => `user:quest-history:${userId}`,
  userStudyHistory:  (userId: string): string => `user:study-history:${userId}`,
  userAchievements:  (userId: string): string => `user:achievements:${userId}`,
};

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!redis) return null;
  try {
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSet<T>(key: string, value: T, ttl: number): Promise<void> {
  if (!redis) return;
  try {
    await redis.setex(key, ttl, JSON.stringify(value));
  } catch {
    // cache é não-crítico — falhas silenciosas
  }
}

export async function cacheDel(...keys: string[]): Promise<void> {
  if (!redis || keys.length === 0) return;
  try {
    await redis.del(...keys);
  } catch {
    // silencioso
  }
}

// SCAN + DEL para evitar KEYS em produção
export async function cacheInvalidatePattern(pattern: string): Promise<void> {
  if (!redis) return;
  try {
    let cursor = "0";
    do {
      const [next, found] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
      cursor = next;
      if (found.length > 0) await redis.del(...found);
    } while (cursor !== "0");
  } catch {
    // silencioso
  }
}

// Cache-aside: retorna do cache ou executa fetcher + armazena
export async function cacheGetOrSet<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number,
): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached !== null) return cached;
  const fresh = await fetcher();
  await cacheSet(key, fresh, ttl);
  return fresh;
}
