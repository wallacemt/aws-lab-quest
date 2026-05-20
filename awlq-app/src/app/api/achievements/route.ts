import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserAchievementSummary } from "@/lib/achievements";
import { cacheGetOrSet, CACHE_KEYS, CACHE_TTL } from "@/lib/cache";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const achievements = await cacheGetOrSet(
    CACHE_KEYS.userAchievements(session.user.id),
    () => getUserAchievementSummary(session.user.id),
    CACHE_TTL.USER_ACHIEVEMENTS,
  );

  return NextResponse.json({ achievements });
}
