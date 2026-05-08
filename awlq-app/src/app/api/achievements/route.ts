import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserAchievementSummary } from "@/lib/achievements";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const achievements = await getUserAchievementSummary(session.user.id);

  return NextResponse.json({ achievements });
}
