import { NextRequest, NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/user-auth";
import { prisma } from "@/lib/prisma";
import { syncUserAchievements } from "@/lib/achievements";

export async function GET(request: NextRequest) {
  const auth = await requireApprovedUser(request);
  if (auth.response) return auth.response;

  const badges = await prisma.userCertBadge.findMany({
    where: { userId: auth.user.id },
    orderBy: { earnedAt: "desc" },
    select: {
      id: true,
      badgeUrl: true,
      badgeImageUrl: true,
      earnedAt: true,
      certificationPreset: { select: { code: true, name: true } },
    },
  });

  return NextResponse.json({ badges });
}

export async function POST(request: NextRequest) {
  const auth = await requireApprovedUser(request);
  if (auth.response) return auth.response;

  const body = (await request.json()) as {
    badgeUrl?: string;
    certificationPresetId?: string | null;
    badgeImageUrl?: string | null;
  };

  const badgeUrl = typeof body.badgeUrl === "string" ? body.badgeUrl.trim() : "";
  if (!badgeUrl) {
    return NextResponse.json({ error: "badgeUrl obrigatorio." }, { status: 400 });
  }

  try {
    new URL(badgeUrl);
  } catch {
    return NextResponse.json({ error: "badgeUrl invalido." }, { status: 400 });
  }

  const badgeImageUrl = typeof body.badgeImageUrl === "string" && body.badgeImageUrl.trim()
    ? body.badgeImageUrl.trim()
    : null;

  const userId = auth.user.id;

  const prevCount = await prisma.userCertBadge.count({ where: { userId } });

  const badge = await prisma.userCertBadge.create({
    data: {
      userId,
      badgeUrl,
      badgeImageUrl,
      certificationPresetId: body.certificationPresetId ?? null,
    },
    select: {
      id: true,
      badgeUrl: true,
      badgeImageUrl: true,
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
