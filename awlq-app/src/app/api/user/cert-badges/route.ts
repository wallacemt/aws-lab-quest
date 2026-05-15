import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncUserAchievements } from "@/lib/achievements";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const badges = await prisma.userCertBadge.findMany({
    where: { userId: session.user.id },
    orderBy: { earnedAt: "desc" },
    select: {
      id: true,
      badgeUrl: true,
      earnedAt: true,
      certificationPreset: { select: { code: true, name: true } },
    },
  });

  return NextResponse.json({ badges });
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { badgeUrl?: string; certificationPresetId?: string | null };

  const badgeUrl = typeof body.badgeUrl === "string" ? body.badgeUrl.trim() : "";
  if (!badgeUrl) {
    return NextResponse.json({ error: "badgeUrl obrigatorio." }, { status: 400 });
  }

  try {
    new URL(badgeUrl);
  } catch {
    return NextResponse.json({ error: "badgeUrl invalido." }, { status: 400 });
  }

  const userId = session.user.id;

  const prevCount = await prisma.userCertBadge.count({ where: { userId } });

  const badge = await prisma.userCertBadge.create({
    data: {
      userId,
      badgeUrl,
      certificationPresetId: body.certificationPresetId ?? null,
    },
    select: {
      id: true,
      badgeUrl: true,
      earnedAt: true,
      certificationPreset: { select: { code: true, name: true } },
    },
  });

  await syncUserAchievements(userId);

  const newCount = await prisma.userCertBadge.count({ where: { userId } });

  return NextResponse.json({
    badge,
    achievementUnlocked: prevCount === 0 && newCount >= 1,
  });
}
