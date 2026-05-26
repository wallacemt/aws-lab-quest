import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.userProfile.findUnique({
    where: { userId: session.user.id },
    select: { certificationPresetId: true, certificationPreset: { select: { code: true, name: true } } },
  });

  if (!profile?.certificationPresetId) {
    return NextResponse.json({ packs: [], certificationCode: null, certificationName: null });
  }

  const { searchParams } = new URL(request.url);
  const filterParam = searchParams.get("filter") ?? "all";

  const packs = await prisma.simuladoPack.findMany({
    where: { certificationPresetId: profile.certificationPresetId, active: true },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      artworkUrl: true,
      difficultyScore: true,
      createdAt: true,
      _count: { select: { questions: true } },
      sessions: {
        where: { userId: session.user.id, sessionType: "SIMULADO" },
        orderBy: { completedAt: "desc" },
        select: {
          id: true,
          scorePercent: true,
          correctAnswers: true,
          totalQuestions: true,
          completedAt: true,
        },
      },
    },
  });

  const items = packs
    .map((pack) => {
      const attempts = pack.sessions.length;
      const bestAttempt =
        attempts > 0
          ? pack.sessions.reduce(
              (best, s) => (s.scorePercent > best.scorePercent ? s : best),
              pack.sessions[0]!,
            )
          : null;

      return {
        id: pack.id,
        name: pack.name,
        questionCount: pack._count.questions,
        artworkUrl: pack.artworkUrl ?? null,
        difficultyScore: pack.difficultyScore,
        createdAt: pack.createdAt.toISOString(),
        attempts,
        bestScore: bestAttempt?.scorePercent ?? null,
        lastSessionId: pack.sessions[0]?.id ?? null,
        sessions: pack.sessions.map((s) => ({
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
    certificationCode: profile.certificationPreset?.code ?? null,
    certificationName: profile.certificationPreset?.name ?? null,
  });
}
