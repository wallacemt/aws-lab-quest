import { NextRequest, NextResponse } from "next/server";
import { getUserAchievementSummary } from "@/lib/achievements";
import { auth } from "@/lib/auth";
import { cacheGetOrSet, CACHE_KEYS, CACHE_TTL } from "@/lib/cache";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await params;

  const profileData = await cacheGetOrSet(
    CACHE_KEYS.userPublicProfile(userId),
    async () => {
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

      if (!user) return null;

      const [labStats, studyStats, history, studyHistory, achievements, certBadges] = await Promise.all([
        prisma.questHistory.aggregate({
          where: { userId },
          _sum: { xp: true },
          _count: { id: true },
        }),
        prisma.studySessionHistory.aggregate({
          where: { userId },
          _sum: { gainedXp: true },
          _count: { id: true },
        }),
        prisma.questHistory.findMany({
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
        }),
        prisma.studySessionHistory.findMany({
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
        }),
        getUserAchievementSummary(userId),
        prisma.userCertBadge.findMany({
          where: { userId },
          orderBy: { earnedAt: "asc" },
          select: {
            id: true,
            badgeUrl: true,
            badgeImageUrl: true,
            earnedAt: true,
            certificationPreset: { select: { code: true, name: true } },
          },
        }),
      ]);

      return {
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          createdAt: user.createdAt,
          avatarUrl:
            user.profile?.avatarUrl ??
            "https://djitwkagdqgbhanenonk.supabase.co/storage/v1/object/public/aws-lab-quest/avatars/49f46e8c-1062-4a9d-adbd-f92027e75e31.jpg",
          certification: user.profile?.certification ?? "",
          favoriteTheme: user.profile?.favoriteTheme ?? "",
        },
        stats: {
          totalXp: (labStats._sum.xp ?? 0) + (studyStats._sum.gainedXp ?? 0),
          labsCompleted: labStats._count.id,
        },
        history,
        studyHistory,
        achievements,
        certBadges,
      };
    },
    CACHE_TTL.USER_PUBLIC_PROFILE,
  );

  if (!profileData) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(profileData);
}
