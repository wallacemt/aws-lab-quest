import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// LGPD Art. 18, V — data portability.
// Returns all personal data held for the authenticated user as a
// structured JSON attachment so the holder can take their data elsewhere.
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const [
    user,
    profile,
    studySessions,
    questHistory,
    achievements,
    badges,
    certBadges,
    // LGPD F-02: Phase 1–4 personal data tables
    flashcards,
    flashcardReviews,
    falseBeliefSignals,
    mentorRecommendations,
    bossBattles,
    weeklyEntries,
    quizAttempts,
    questProgress,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        role: true,
        accessStatus: true,
        createdAt: true,
        lastSeen: true,
      },
    }),
    prisma.userProfile.findUnique({
      where: { userId },
      select: {
        certification: true,
        favoriteTheme: true,
        avatarUrl: true,
        leaderboardVisible: true,
        themePreset: true,
      },
    }),
    prisma.studySessionHistory.findMany({
      where: { userId, anonymized: false },
      orderBy: { completedAt: "desc" },
      select: {
        id: true,
        sessionType: true,
        title: true,
        certificationCode: true,
        gainedXp: true,
        scorePercent: true,
        correctAnswers: true,
        totalQuestions: true,
        durationSeconds: true,
        completedAt: true,
      },
    }),
    prisma.questHistory.findMany({
      where: { userId },
      orderBy: { completedAt: "desc" },
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
    prisma.userAchievement.findMany({
      where: { userId },
      include: {
        achievement: { select: { code: true, name: true, description: true, rarity: true } },
      },
    }),
    prisma.userBadge.findMany({
      where: { userId },
      include: {
        badge: { select: { level: true, name: true } },
      },
    }),
    prisma.userCertBadge.findMany({
      where: { userId },
      select: {
        badgeUrl: true,
        earnedAt: true,
        certificationPreset: { select: { code: true, name: true } },
      },
    }),
    // Phase 1 — Retention spine
    prisma.flashcard.findMany({
      where: { userId },
      select: {
        front: true,
        back: true,
        hint: true,
        dueAt: true,
        easeFactor: true,
        intervalDays: true,
        repetitions: true,
        createdAt: true,
      },
    }),
    prisma.flashcardReview.findMany({
      where: { flashcard: { userId } },
      select: { grade: true, prevInterval: true, newInterval: true, reviewedAt: true },
    }),
    // Phase 2 — Mentor
    prisma.falseBeliefSignal.findMany({
      where: { userId },
      select: {
        awsServiceId: true,
        topic: true,
        falseBeliefCount: true,
        knownGapCount: true,
        masteryCount: true,
        computedAt: true,
      },
    }),
    prisma.mentorRecommendation.findMany({
      where: { userId },
      select: { rank: true, actionType: true, title: true, rationale: true, generatedAt: true },
    }),
    // Phase 4 — Arena / Weekly / Daily Quiz
    prisma.bossBattle.findMany({
      where: { userId },
      select: { bossId: true, remainingHp: true, victory: true, gainedXp: true, finishedAt: true, createdAt: true },
    }),
    prisma.weeklyChallengeEntry.findMany({
      where: { userId },
      select: { score: true, rank: true },
    }),
    prisma.dailyQuizAttempt.findMany({
      where: { userId },
      select: { score: true, totalCount: true, gainedXp: true, completedAt: true },
    }),
    // Quest Chains
    prisma.questChainProgress.findMany({
      where: { userId },
      select: { stageId: true, completed: true, completedAt: true },
    }),
  ]);

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    profile: {
      ...user,
      ...profile,
    },
    studySessions,
    questHistory,
    achievements: achievements.map((a) => ({
      code: a.achievement.code,
      name: a.achievement.name,
      description: a.achievement.description,
      rarity: a.achievement.rarity,
      unlockedAt: a.unlockedAt,
      progress: a.progress,
    })),
    levelBadges: badges.map((b) => ({
      level: b.badge.level,
      name: b.badge.name,
      earnedAt: b.earnedAt,
    })),
    certificationBadges: certBadges,
    // LGPD F-02: Phase 1–4 personal data
    flashcards,
    flashcardReviews,
    falseBeliefSignals,
    mentorRecommendations,
    bossBattles,
    weeklyEntries,
    quizAttempts,
    questProgress,
  };

  const json = JSON.stringify(exportPayload, null, 2);

  return new NextResponse(json, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": 'attachment; filename="meus-dados.json"',
    },
  });
}
