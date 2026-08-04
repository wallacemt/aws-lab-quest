import { NextRequest, NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/user-auth";
import { getUserAchievementSummary } from "@/lib/achievements";
import { cacheGetOrSet, CACHE_KEYS, CACHE_TTL } from "@/lib/cache";

export async function GET(request: NextRequest) {
  const auth = await requireApprovedUser(request);
  if (auth.response) return auth.response;

  const achievements = await cacheGetOrSet(
    CACHE_KEYS.userAchievements(auth.user.id),
    () => getUserAchievementSummary(auth.user.id),
    CACHE_TTL.USER_ACHIEVEMENTS,
  );

  return NextResponse.json({ achievements });
}
