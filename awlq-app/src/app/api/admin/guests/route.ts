import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { redis, scanKeys } from "@/lib/redis";

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;
  if (!redis) return NextResponse.json({ guests: [] });

  const keys = await scanKeys("online:guest:*");
  if (keys.length === 0) return NextResponse.json({ guests: [] });
  try {
    const values = await redis.mget(...keys);
    const guests = values.flatMap((value, index) => {
      if (!value) return [];
      try {
        const guest = JSON.parse(value) as { displayName?: string; lastSeen?: string };
        return [{
          guestSessionId: keys[index]!.slice("online:guest:".length),
          displayName: guest.displayName ?? "Convidado",
          lastSeen: guest.lastSeen ?? new Date().toISOString(),
        }];
      } catch {
        return [];
      }
    });
    return NextResponse.json({ guests });
  } catch {
    return NextResponse.json({ guests: [] });
  }
}
