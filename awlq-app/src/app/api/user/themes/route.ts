import { NextRequest, NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/user-auth";
import { prisma } from "@/lib/prisma";
import { isValidColorMap } from "@/lib/themes";
import { isValidThemeImageUrl } from "@/lib/backgrounds";
import { cacheDel, CACHE_KEYS } from "@/lib/cache";

const MAX_THEMES_PER_USER = 12;
const MAX_NAME_LENGTH = 40;

export async function GET(request: NextRequest) {
  const auth = await requireApprovedUser(request);
  if (auth.response) return auth.response;

  const themes = await prisma.userTheme.findMany({
    where: { userId: auth.user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ themes });
}

export async function POST(request: NextRequest) {
  const auth = await requireApprovedUser(request);
  if (auth.response) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido." }, { status: 400 });
  }

  const { name, colors, bgImageUrl } = body as {
    name?: string;
    colors?: unknown;
    bgImageUrl?: string | null;
  };

  const trimmedName = (name ?? "").trim();
  if (!trimmedName || trimmedName.length > MAX_NAME_LENGTH) {
    return NextResponse.json(
      { error: `Nome do tema deve ter entre 1 e ${MAX_NAME_LENGTH} caracteres.` },
      { status: 422 },
    );
  }

  if (!isValidColorMap(colors)) {
    return NextResponse.json({ error: "Cores invalidas." }, { status: 422 });
  }

  if (bgImageUrl !== undefined && !isValidThemeImageUrl(bgImageUrl)) {
    return NextResponse.json({ error: "Imagem deve ser enviada via upload." }, { status: 422 });
  }

  const count = await prisma.userTheme.count({ where: { userId: auth.user.id } });
  if (count >= MAX_THEMES_PER_USER) {
    return NextResponse.json(
      { error: `Limite de ${MAX_THEMES_PER_USER} temas salvos atingido. Exclua um tema para criar outro.` },
      { status: 422 },
    );
  }

  const theme = await prisma.userTheme.create({
    data: {
      userId: auth.user.id,
      name: trimmedName,
      colors,
      bgImageUrl: bgImageUrl || null,
    },
  });

  await cacheDel(CACHE_KEYS.communityThemes());

  return NextResponse.json({ theme });
}
