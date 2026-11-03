import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { getGuestDisplayName } from "@/lib/guest-session";

const COOKIE_NAME = "guest_session_id";
const TTL_SECONDS = 90;

export async function POST(request: NextRequest) {
  if (!redis) return NextResponse.json({ ok: true, guestTracking: false });

  const existingId = request.cookies.get(COOKIE_NAME)?.value;
  const guestSessionId = existingId || randomUUID();
  const displayName = getGuestDisplayName(guestSessionId);
  try {
    await redis.set(
      `online:guest:${guestSessionId}`,
      JSON.stringify({ displayName, lastSeen: new Date().toISOString() }),
      "EX",
      TTL_SECONDS,
    );
  } catch {
    return NextResponse.json({ ok: true, guestTracking: false });
  }

  const response = NextResponse.json({ ok: true, guestTracking: true });
  if (!existingId) {
    response.cookies.set(COOKIE_NAME, guestSessionId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 12,
      path: "/",
    });
  }
  return response;
}
