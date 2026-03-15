import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const groupedLabs = await prisma.questHistory.groupBy({
    by: ["userId"],
    _sum: { xp: true },
    _count: { id: true },
  });

  const groupedStudy = await prisma.studySessionHistory.groupBy({
    by: ["userId"],
    _sum: { gainedXp: true },
  });

  const merged = new Map<string, { userId: string; totalXp: number; labsCompleted: number }>();

  for (const entry of groupedLabs) {
    merged.set(entry.userId, {
      userId: entry.userId,
      totalXp: entry._sum.xp ?? 0,
      labsCompleted: entry._count.id,
    });
  }

  for (const entry of groupedStudy) {
    const current = merged.get(entry.userId);
    if (current) {
      current.totalXp += entry._sum.gainedXp ?? 0;
      merged.set(entry.userId, current);
      continue;
    }

    merged.set(entry.userId, {
      userId: entry.userId,
      totalXp: entry._sum.gainedXp ?? 0,
      labsCompleted: 0,
    });
  }

  const topEntries = Array.from(merged.values())
    .sort((a, b) => b.totalXp - a.totalXp)
    .slice(0, 10);

  const leaderboard: Array<{
    rank: number;
    userId: string;
    name: string;
    username: string | null;
    avatarUrl: string | null;
    totalXp: number;
    labsCompleted: number;
    isCurrentUser: boolean;
  }> = [];

  for (let index = 0; index < topEntries.length; index += 1) {
    const entry = topEntries[index];
    const user = await prisma.user.findUnique({
      where: { id: entry.userId },
      include: { profile: { select: { avatarUrl: true } } },
    });

    leaderboard.push({
      rank: index + 1,
      userId: entry.userId,
      name: user?.name ?? "Anonimo",
      username: user?.username ?? null,
      avatarUrl: user?.profile?.avatarUrl ?? "https://djitwkagdqgbhanenonk.supabase.co/storage/v1/object/public/aws-lab-quest/avatars/49f46e8c-1062-4a9d-adbd-f92027e75e31.jpg" ,
      totalXp: entry.totalXp,
      labsCompleted: entry.labsCompleted,
      isCurrentUser: entry.userId === session.user.id,
    });
  }

  return NextResponse.json({ leaderboard });
}
