import { NextRequest, NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/user-auth";
import { prisma } from "@/lib/prisma";
import { cacheDel, CACHE_KEYS } from "@/lib/cache";

const MAX_NAME_LENGTH = 40;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ themeId: string }> }) {
  const auth = await requireApprovedUser(request);
  if (auth.response) return auth.response;

  const { themeId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido." }, { status: 400 });
  }

  const { name, isPublic } = body as { name?: string; isPublic?: boolean };

  const data: { name?: string; isPublic?: boolean } = {};
  if (name !== undefined) {
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length > MAX_NAME_LENGTH) {
      return NextResponse.json(
        { error: `Nome do tema deve ter entre 1 e ${MAX_NAME_LENGTH} caracteres.` },
        { status: 422 },
      );
    }
    data.name = trimmedName;
  }
  if (isPublic !== undefined) data.isPublic = Boolean(isPublic);

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nenhum campo para atualizar." }, { status: 400 });
  }

  const { count } = await prisma.userTheme.updateMany({
    where: { id: themeId, userId: auth.user.id },
    data,
  });

  if (count === 0) {
    return NextResponse.json({ error: "Tema nao encontrado." }, { status: 404 });
  }

  await cacheDel(CACHE_KEYS.communityThemes());

  const theme = await prisma.userTheme.findUnique({ where: { id: themeId } });
  return NextResponse.json({ theme });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ themeId: string }> }) {
  const auth = await requireApprovedUser(request);
  if (auth.response) return auth.response;

  const { themeId } = await params;

  const { count } = await prisma.userTheme.deleteMany({
    where: { id: themeId, userId: auth.user.id },
  });

  if (count === 0) {
    return NextResponse.json({ error: "Tema nao encontrado." }, { status: 404 });
  }

  await cacheDel(CACHE_KEYS.communityThemes());

  return NextResponse.json({ ok: true });
}
