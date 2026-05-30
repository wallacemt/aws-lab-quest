import { NextRequest, NextResponse } from "next/server";
import { getUserAchievementSummary } from "@/lib/achievements";
import { auth } from "@/lib/auth";
import { cacheGetOrSet, CACHE_KEYS, CACHE_TTL } from "@/lib/cache";
import { prisma } from "@/lib/prisma";

const QUEST_SELECT = {
  id: true,
  title: true,
  theme: true,
  xp: true,
  tasksCount: true,
  taskSnapshot: true,
  sourceLabText: true,
  completedAt: true,
  certification: true,
  userName: true,
} as const;

const STUDY_SELECT = {
  id: true,
  sessionType: true,
  title: true,
  certificationCode: true,
  gainedXp: true,
  scorePercent: true,
  correctAnswers: true,
  totalQuestions: true,
  durationSeconds: true,
  answersSnapshot: true,
  completedAt: true,
  pack: { select: { name: true, artworkUrl: true } },
} as const;

export async function GET(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await params;
  const fullHistory = request.nextUrl.searchParams.get("fullHistory") === "true";

  if (fullHistory) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        profile: { select: { leaderboardVisible: true } },
      },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Owners always see their own history regardless of leaderboard opt-out.
    // The 403 only applies when a *different* authenticated user requests the
    // full history of someone who opted out of public visibility.
    const isOwner = session.user.id === userId;
    if (!isOwner && user.profile?.leaderboardVisible === false) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [labHistory, studyHistoryRaw] = await Promise.all([
      prisma.questHistory.findMany({
        where: { userId },
        orderBy: { completedAt: "desc" },
        select: QUEST_SELECT,
      }),
      prisma.studySessionHistory.findMany({
        where: { userId, anonymized: false },
        orderBy: { completedAt: "desc" },
        select: STUDY_SELECT,
      }),
    ]);

    const studyHistory = studyHistoryRaw.map((s) => ({
      ...s,
      pack: undefined,
      packName: s.pack?.name ?? null,
      packArtworkUrl: s.pack?.artworkUrl ?? null,
    }));

    return NextResponse.json({ labHistory, studyHistory });
  }

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
              leaderboardVisible: true,
            },
          },
        },
      });

      if (!user) return null;

      // User opted out of public visibility — return minimal stub
      if (user.profile?.leaderboardVisible === false) {
        return {
          user: {
            id: user.id,
            name: "Usuário Privado",
            username: null,
            createdAt: user.createdAt,
            avatarUrl: null,
            certification: "",
            favoriteTheme: "",
          },
          stats: { totalXp: 0, labsCompleted: 0 },
          history: [],
          studyHistory: [],
          achievements: { items: [], unlockedCount: 0 },
          certBadges: [],
          isPrivate: true,
        };
      }

      const [labStats, studyStats, history, studyHistory, achievements, certBadges] = await Promise.all([
        prisma.questHistory.aggregate({
          where: { userId },
          _sum: { xp: true },
          _count: { id: true },
        }),
        prisma.studySessionHistory.aggregate({
          where: { userId, anonymized: false },
          _sum: { gainedXp: true },
          _count: { id: true },
        }),
        prisma.questHistory.findMany({
          where: { userId },
          orderBy: { completedAt: "desc" },
          take: 10,
          select: QUEST_SELECT,
        }),
        prisma.studySessionHistory.findMany({
          where: { userId, anonymized: false },
          orderBy: { completedAt: "desc" },
          take: 8,
          select: { id: true, sessionType: true, title: true, certificationCode: true, gainedXp: true, scorePercent: true, correctAnswers: true, totalQuestions: true, completedAt: true },
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
          avatarUrl: user.profile?.avatarUrl ?? "/default-avatar.png",
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
