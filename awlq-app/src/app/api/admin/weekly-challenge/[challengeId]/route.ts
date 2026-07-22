import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ challengeId: string }> };

/**
 * GET /api/admin/weekly-challenge/[challengeId] — full leaderboard for one challenge.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { challengeId } = await params;
  const challenge = await prisma.weeklyChallenge.findUnique({
    where: { id: challengeId },
    include: {
      entries: {
        orderBy: [{ score: "desc" }, { updatedAt: "asc" }],
        select: {
          userId: true,
          score: true,
          rank: true,
          gainedXp: true,
          createdAt: true,
          user: { select: { name: true, email: true } },
        },
      },
    },
  });

  if (!challenge) return NextResponse.json({ error: "Desafio nao encontrado." }, { status: 404 });

  return NextResponse.json({
    challenge: {
      id: challenge.id,
      weekStart: challenge.weekStart.toISOString(),
      weekEnd: challenge.weekEnd.toISOString(),
      active: challenge.active,
      badgeImageUrl: challenge.badgeImageUrl,
    },
    entries: challenge.entries.map((e) => ({
      userId: e.userId,
      name: e.user.name,
      email: e.user.email,
      score: e.score,
      rank: e.rank,
      gainedXp: e.gainedXp,
      submittedAt: e.createdAt.toISOString(),
    })),
  });
}

type UpdateBody = { active?: boolean };

/**
 * PATCH /api/admin/weekly-challenge/[challengeId] — activate/deactivate.
 * Activating a challenge deactivates every other one first (only one challenge
 * can be "the current week" for the user-facing GET /api/weekly-challenge, which
 * picks the most recent active row — mirrors weekly-challenge.worker's openWeeklyChallenge).
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { challengeId } = await params;

  let body: UpdateBody;
  try {
    body = (await request.json()) as UpdateBody;
  } catch {
    return NextResponse.json({ error: "Corpo JSON invalido." }, { status: 400 });
  }

  if (typeof body.active !== "boolean") {
    return NextResponse.json({ error: "'active' (boolean) e obrigatorio." }, { status: 400 });
  }

  const existing = await prisma.weeklyChallenge.findUnique({ where: { id: challengeId }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Desafio nao encontrado." }, { status: 404 });

  const challenge = await prisma.$transaction(async (tx) => {
    if (body.active) {
      await tx.weeklyChallenge.updateMany({
        where: { active: true, NOT: { id: challengeId } },
        data: { active: false },
      });
    }
    return tx.weeklyChallenge.update({ where: { id: challengeId }, data: { active: body.active } });
  });

  return NextResponse.json({ challenge });
}
