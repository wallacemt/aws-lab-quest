import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ONLINE_WINDOW_MINUTES = 5;

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const cutoff = new Date(now.getTime() - ONLINE_WINDOW_MINUTES * 60 * 1000);

  const activeSessions = await prisma.session.groupBy({
    by: ["userId"],
    where: {
      expiresAt: { gt: now },
    },
  });

  if (activeSessions.length === 0) {
    return NextResponse.json({ onlineCount: 0, windowMinutes: ONLINE_WINDOW_MINUTES });
  }

  const activeUserIds = activeSessions.map((item) => item.userId);

  const onlineCount = await prisma.user.count({
    where: {
      id: { in: activeUserIds },
      lastSeen: { gte: cutoff },
    },
  });

  return NextResponse.json({
    onlineCount,
    windowMinutes: ONLINE_WINDOW_MINUTES,
  });
}
