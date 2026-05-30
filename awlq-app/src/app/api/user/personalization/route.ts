import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { THEME_PRESETS } from "@/lib/themes";

const KNOWN_THEME_IDS = new Set(THEME_PRESETS.map((t) => t.id));

function isValidBgImageUrl(value: unknown): value is string | null {
  if (value === null || value === undefined) return true;
  if (typeof value !== "string") return false;
  if (value === "") return true;
  return value.startsWith("https://");
}

export async function PATCH(request: NextRequest) {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido." }, { status: 400 });
  }

  const { bgImageUrl, themePreset } = body as {
    bgImageUrl?: string | null;
    themePreset?: string;
  };

  if (bgImageUrl !== undefined && !isValidBgImageUrl(bgImageUrl)) {
    return NextResponse.json(
      { error: "bgImageUrl deve ser uma URL https:// valida ou null." },
      { status: 422 },
    );
  }

  if (themePreset !== undefined && !KNOWN_THEME_IDS.has(themePreset)) {
    return NextResponse.json({ error: "themePreset invalido." }, { status: 422 });
  }

  const data: { bgImageUrl?: string | null; themePreset?: string } = {};
  if (bgImageUrl !== undefined) data.bgImageUrl = bgImageUrl || null;
  if (themePreset !== undefined) data.themePreset = themePreset;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nenhum campo para atualizar." }, { status: 400 });
  }

  const updated = await prisma.userProfile.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      ...data,
    },
    update: data,
    select: { bgImageUrl: true, themePreset: true },
  });

  return NextResponse.json(updated);
}
