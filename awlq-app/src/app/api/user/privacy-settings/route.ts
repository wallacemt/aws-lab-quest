import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cacheDel, CACHE_KEYS } from "@/lib/cache";

type PrivacySettingsBody = {
  leaderboardVisible?: boolean;
};

export async function PATCH(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as PrivacySettingsBody;

  if (typeof body.leaderboardVisible !== "boolean") {
    return NextResponse.json({ error: "leaderboardVisible must be a boolean." }, { status: 400 });
  }

  await prisma.userProfile.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, leaderboardVisible: body.leaderboardVisible },
    update: { leaderboardVisible: body.leaderboardVisible },
  });

  // Invalidate leaderboard cache so the change takes effect immediately
  await cacheDel(CACHE_KEYS.leaderboard());

  return NextResponse.json({ ok: true });
}
