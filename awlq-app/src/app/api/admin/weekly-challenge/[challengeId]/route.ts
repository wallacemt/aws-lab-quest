import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ challengeId: string }>;
}

interface UpdateBody {
  active?: boolean;
  title?: string | null;
}

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

  if (!challenge) {
    return NextResponse.json({ error: "Desafio nao encontrado." }, { status: 404 });
  }

  return NextResponse.json({
    challenge: {
      id: challenge.id,
      title: challenge.title,
      weekStart: challenge.weekStart.toISOString(),
      weekEnd: challenge.weekEnd.toISOString(),
      active: challenge.active,
      badgeImageUrl: challenge.badgeImageUrl,
      entries: challenge.entries.map((e) => ({
        userId: e.userId,
        name: e.user.name,
        email: e.user.email,
        score: e.score,
        rank: e.rank,
        gainedXp: e.gainedXp,
        createdAt: e.createdAt.toISOString(),
      })),
    },
  });
}

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

  if (body.active === undefined && body.title === undefined) {
    return NextResponse.json({ error: "Informe 'active' e/ou 'title'." }, { status: 400 });
  }
  if (body.active !== undefined && typeof body.active !== "boolean") {
    return NextResponse.json({ error: "'active' deve ser boolean." }, { status: 400 });
  }
  if (body.title !== undefined && body.title !== null && typeof body.title !== "string") {
    return NextResponse.json({ error: "'title' deve ser string ou null." }, { status: 400 });
  }

  const existing = await prisma.weeklyChallenge.findUnique({ where: { id: challengeId }, select: { id: true } });
  if (!existing) {
    return NextResponse.json({ error: "Desafio nao encontrado." }, { status: 404 });
  }

  const data: { active?: boolean; title?: string | null } = {};
  if (body.active !== undefined) data.active = body.active;
  if (body.title !== undefined) data.title = body.title;

  const challenge = await prisma.$transaction(async (tx) => {
    if (body.active === true) {
      await tx.weeklyChallenge.updateMany({
        where: { active: true, NOT: { id: challengeId } },
        data: { active: false },
      });
    }
    return tx.weeklyChallenge.update({ where: { id: challengeId }, data });
  });

  return NextResponse.json({ challenge });
}
