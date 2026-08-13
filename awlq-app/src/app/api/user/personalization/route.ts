import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireApprovedUser } from "@/lib/user-auth";
import { prisma } from "@/lib/prisma";
import { THEME_PRESETS } from "@/lib/themes";
import { cacheDel, CACHE_KEYS } from "@/lib/cache";
import { isValidBgImageUrl } from "@/lib/backgrounds";

const KNOWN_THEME_IDS = new Set(THEME_PRESETS.map((t) => t.id));

export async function PATCH(request: NextRequest) {
  const auth = await requireApprovedUser(request);
  if (auth.response) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido." }, { status: 400 });
  }

  const { bgImageUrl, themePreset, customThemeId } = body as {
    bgImageUrl?: string | null;
    themePreset?: string;
    customThemeId?: string | null;
  };

  if (bgImageUrl !== undefined && !isValidBgImageUrl(bgImageUrl)) {
    return NextResponse.json(
      { error: "bgImageUrl deve ser uma URL https:// valida, null, ou um preset padrao." },
      { status: 422 },
    );
  }

  if (themePreset !== undefined && !KNOWN_THEME_IDS.has(themePreset)) {
    return NextResponse.json({ error: "themePreset invalido." }, { status: 422 });
  }

  const data: {
    bgImageUrl?: string | null;
    themePreset?: string;
    customColors?: Prisma.InputJsonValue | typeof Prisma.JsonNull;
  } = {};
  if (bgImageUrl !== undefined) data.bgImageUrl = bgImageUrl || null;
  if (themePreset !== undefined) {
    data.themePreset = themePreset;
    // Picking a builtin preset clears any active custom theme.
    data.customColors = Prisma.JsonNull;
  }

  if (customThemeId !== undefined) {
    if (customThemeId === null) {
      data.customColors = Prisma.JsonNull;
    } else {
      // Own theme or a published community theme — both applyable.
      const theme = await prisma.userTheme.findFirst({
        where: { id: customThemeId, OR: [{ userId: auth.user.id }, { isPublic: true }] },
        select: { colors: true, bgImageUrl: true },
      });
      if (!theme) {
        return NextResponse.json({ error: "Tema nao encontrado." }, { status: 404 });
      }
      data.customColors = theme.colors as Prisma.InputJsonValue;
      if (theme.bgImageUrl) data.bgImageUrl = theme.bgImageUrl;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nenhum campo para atualizar." }, { status: 400 });
  }

  const updated = await prisma.userProfile.upsert({
    where: { userId: auth.user.id },
    create: { userId: auth.user.id, ...data },
    update: data,
    select: { bgImageUrl: true, themePreset: true, customColors: true },
  });

  // Invalidate the user profile cache so the next GET /api/user/profile
  // returns the updated theme/bg immediately (no stale 10-min window).
  await cacheDel(
    CACHE_KEYS.userProfile(auth.user.id),
    CACHE_KEYS.userPublicProfile(auth.user.id),
  );

  return NextResponse.json(updated);
}
