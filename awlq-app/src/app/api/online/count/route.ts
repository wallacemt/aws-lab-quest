import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis, scanKeys } from "@/lib/redis";

const ONLINE_WINDOW_MINUTES = 5;

export async function GET() {
  const now = new Date();
  const cutoff = new Date(now.getTime() - ONLINE_WINDOW_MINUTES * 60 * 1000);

  const activeSessions = await prisma.session.groupBy({
    by: ["userId"],
    where: { expiresAt: { gt: now } },
  });

  const activeUserIds = activeSessions.map((s) => s.userId);
  const usersOnline = activeUserIds.length > 0
    ? await prisma.user.count({ where: { id: { in: activeUserIds }, lastSeen: { gte: cutoff } } })
    : 0;
  const guestCount = redis ? (await scanKeys("online:guest:*")).length : 0;
  const onlineCount = usersOnline + guestCount;

  return NextResponse.json({ onlineCount, guestCount, windowMinutes: ONLINE_WINDOW_MINUTES });
}
