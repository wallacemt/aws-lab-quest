import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

function parseDays(value: string | null): number {
  const parsed = Number(value ?? 30);
  if (!Number.isFinite(parsed)) return 30;
  return Math.max(7, Math.min(180, Math.round(parsed)));
}

export async function GET(request: NextRequest) {
  const authResult = await requireAdmin(request);
  if (!authResult.ok) return authResult.response;

  const days = parseDays(request.nextUrl.searchParams.get("days"));
  const startDate = new Date(Date.now() - days * 86_400_000);

  const [
    total,
    flaggedCount,
    addedInPeriod,
    difficultyGroups,
    certGroups,
    recentlyAdded,
  ] = await Promise.all([
    prisma.studyQuestion.count(),
    prisma.questionPerformance.count({ where: { flaggedForReview: true } }),
    prisma.studyQuestion.count({ where: { createdAt: { gte: startDate } } }),
    prisma.studyQuestion.groupBy({
      by: ["difficulty"],
      _count: { _all: true },
    }),
    prisma.studyQuestion.groupBy({
      by: ["certificationPresetId"],
      _count: { _all: true },
      orderBy: { _count: { certificationPresetId: "desc" } },
      take: 8,
    }),
    prisma.studyQuestion.findMany({
      where: { active: true },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        statement: true,
        difficulty: true,
        createdAt: true,
        certificationPreset: { select: { code: true } },
      },
    }),
  ]);

  // Resolve certification names for the grouped cert IDs
  const certIds = certGroups
    .map((g) => g.certificationPresetId)
    .filter((id): id is string => typeof id === "string");

  const certifications =
    certIds.length > 0
      ? await prisma.certificationPreset.findMany({
          where: { id: { in: certIds } },
          select: { id: true, code: true, name: true },
        })
      : [];

  const certById = new Map(certifications.map((c) => [c.id, c]));

  const byCertification = certGroups
    .map((g) => {
      const cert = g.certificationPresetId ? certById.get(g.certificationPresetId) : null;
      return {
        code: cert?.code ?? "SEM_CERT",
        name: cert?.name ?? "Sem certificacao",
        count: g._count._all,
      };
    })
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({
    total,
    flaggedCount,
    flaggedPercent: total > 0 ? Math.round((flaggedCount / total) * 100) : 0,
    addedInPeriod,
    byDifficulty: difficultyGroups.map((g) => ({
      difficulty: g.difficulty,
      count: g._count._all,
    })),
    byCertification,
    recentlyAdded: recentlyAdded.map((q) => ({
      id: q.id,
      statement: q.statement.slice(0, 100),
      difficulty: q.difficulty,
      certCode: q.certificationPreset?.code ?? null,
      createdAt: q.createdAt.toISOString(),
    })),
  });
}
