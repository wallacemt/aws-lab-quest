import { NextRequest, NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/user-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireApprovedUser(request);
  if (!auth.user && auth.response?.status !== 401) return auth.response;

  const { searchParams } = new URL(request.url);
  const filterParam = searchParams.get("filter") ?? "all";
  const guestCode = searchParams.get("certCode");
  const profile = auth.user
    ? await prisma.userProfile.findUnique({
        where: { userId: auth.user.id },
        select: { certificationPresetId: true, certificationPreset: { select: { code: true, name: true, examMinutes: true, passingScorePercent: true } } },
      })
      : null;

  // Guest lookups resolve the active preset directly rather than through a user profile.
  const guestPreset = !auth.user && guestCode
    ? await prisma.certificationPreset.findFirst({
        where: { code: guestCode, active: true },
        select: { id: true, code: true, name: true, examMinutes: true, passingScorePercent: true },
      })
    : null;
  const presetId = auth.user ? profile?.certificationPresetId : guestPreset?.id;
  const preset = auth.user ? profile?.certificationPreset : guestPreset;

  if (!presetId || !preset) {
    return NextResponse.json({ packs: [], certificationCode: null, certificationName: null, passingScorePercent: null });
  }

  const packs = await prisma.simuladoPack.findMany({
    where: { certificationPresetId: presetId, active: true, ...(filterParam === "skill-builder" ? { isSkillBuilder: true } : {}) },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      isSkillBuilder: true,
      artworkUrl: true,
      difficultyScore: true,
      createdAt: true,
      _count: { select: { questions: true } },
      journeyNarrative:true,
      sessions: auth.user ? {
        where: { userId: auth.user.id, sessionType: "SIMULADO" },
        orderBy: { completedAt: "desc" },
        select: {
          id: true,
          scorePercent: true,
          correctAnswers: true,
          totalQuestions: true,
          completedAt: true,
        },
      } : false,
    },
  });

  const items = packs
    .map((pack) => {
      const sessions = pack.sessions ?? [];
      const attempts = sessions.length;
      const bestAttempt =
        attempts > 0
          ? pack.sessions.reduce(
              (best, s) => (s.scorePercent > best.scorePercent ? s : best),
              sessions[0]!,
            )
          : null;

      return {
        id: pack.id,
        name: pack.name,
        isSkillBuilder: pack.isSkillBuilder,
        // awsContext: pack.journeyNarrative.
        questionCount: pack._count.questions,
        examMinutes: preset.examMinutes ?? 90,
        artworkUrl: pack.artworkUrl ?? null,
        difficultyScore: pack.difficultyScore,
        createdAt: pack.createdAt.toISOString(),
        attempts,
        bestScore: bestAttempt?.scorePercent ?? null,
        lastSessionId: sessions[0]?.id ?? null,
        sessions: sessions.map((s) => ({
          id: s.id,
          scorePercent: s.scorePercent,
          correctAnswers: s.correctAnswers,
          totalQuestions: s.totalQuestions,
          completedAt: s.completedAt.toISOString(),
        })),
      };
    })
    .filter((pack) => {
      if (filterParam === "todo") return pack.attempts === 0;
      if (filterParam === "done") return pack.attempts > 0;
      return true;
    });

  return NextResponse.json({
    packs: items,
    certificationCode: preset.code ?? null,
    certificationName: preset.name ?? null,
    passingScorePercent: preset.passingScorePercent ?? 70,
  });
}
