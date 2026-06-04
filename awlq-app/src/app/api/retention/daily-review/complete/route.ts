import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { recordStudyActivity } from "@/lib/streak";

/**
 * POST /api/retention/daily-review/complete
 * Called by the client when the user finishes the daily review session.
 * Increments the streak — exactly once per calendar day (idempotent in streak.ts).
 * Moving this out of the GET handler fixes DEF-004: streak was being incremented
 * simply by opening the daily-review page, not on actual completion.
 */
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await recordStudyActivity(session.user.id, "daily_review", 1);

  return NextResponse.json({
    streakDays: result.streakDays,
    incrementedToday: result.incrementedToday,
  });
}
