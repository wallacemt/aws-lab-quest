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
      username: true,
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
  const labStats = await prisma.questHistory.aggregate({
    where: { userId },
    _sum: { xp: true },
    _count: { id: true },
  });

  const studyStats = await prisma.studySessionHistory.aggregate({
    where: { userId },
    _sum: { gainedXp: true },
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

  const studyHistory = await prisma.studySessionHistory.findMany({
    where: { userId },
    orderBy: { completedAt: "desc" },
    take: 8,
    select: {
      id: true,
      sessionType: true,
      title: true,
      certificationCode: true,
      gainedXp: true,
      scorePercent: true,
      correctAnswers: true,
      totalQuestions: true,
      completedAt: true,
    },
  });

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      createdAt: user.createdAt,
      avatarUrl: user.profile?.avatarUrl ?? "https://djitwkagdqgbhanenonk.supabase.co/storage/v1/object/public/aws-lab-quest/avatars/49f46e8c-1062-4a9d-adbd-f92027e75e31.jpg",
      certification: user.profile?.certification ?? "",
      favoriteTheme: user.profile?.favoriteTheme ?? "",
    },
    stats: {
      totalXp: (labStats._sum.xp ?? 0) + (studyStats._sum.gainedXp ?? 0),
      labsCompleted: labStats._count.id,
    },
    history,
    studyHistory,
  });
}
