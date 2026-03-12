import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      createdAt: true,
      profile: {
        select: {
          avatarUrl: true,
          certification: true,
          favoriteTheme: true,
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Aggregate XP and lab count
  const stats = await prisma.questHistory.aggregate({
    where: { userId },
    _sum: { xp: true },
    _count: { id: true },
  });

  // Recent quest history (last 10, public)
  const history = await prisma.questHistory.findMany({
    where: { userId },
    orderBy: { completedAt: "desc" },
    take: 10,
    select: {
      id: true,
      title: true,
      theme: true,
      xp: true,
      tasksCount: true,
      completedAt: true,
      certification: true,
    },
  });

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      createdAt: user.createdAt,
      avatarUrl: user.profile?.avatarUrl ?? null,
      certification: user.profile?.certification ?? "",
      favoriteTheme: user.profile?.favoriteTheme ?? "",
    },
    stats: {
      totalXp: stats._sum.xp ?? 0,
      labsCompleted: stats._count.id,
    },
    history,
  });
}
