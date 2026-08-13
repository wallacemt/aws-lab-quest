import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { cacheDel, CACHE_KEYS } from "@/lib/cache";

type RouteParams = { params: Promise<{ themeId: string }> };

// Admin moderation: unpublish without deleting (theme stays in the creator's "Meus Temas").
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) return adminCheck.response;

  const { themeId } = await params;

  let body: { isPublic?: boolean };
  try {
    body = (await request.json()) as { isPublic?: boolean };
  } catch {
    return NextResponse.json({ error: "JSON invalido." }, { status: 400 });
  }

  if (body.isPublic === undefined) {
    return NextResponse.json({ error: "isPublic e obrigatorio." }, { status: 400 });
  }

  const existing = await prisma.userTheme.findUnique({ where: { id: themeId } });
  if (!existing) return NextResponse.json({ error: "Tema nao encontrado." }, { status: 404 });

  const theme = await prisma.userTheme.update({
    where: { id: themeId },
    data: { isPublic: body.isPublic },
    include: { user: { select: { id: true, name: true, username: true, email: true } } },
  });

  await cacheDel(CACHE_KEYS.communityThemes());

  return NextResponse.json({ theme });
}

// Admin can remove any theme (own-content ownership check does not apply here) — for moderation/audit.
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) return adminCheck.response;

  const { themeId } = await params;

  const existing = await prisma.userTheme.findUnique({ where: { id: themeId } });
  if (!existing) return NextResponse.json({ error: "Tema nao encontrado." }, { status: 404 });

  await prisma.userTheme.delete({ where: { id: themeId } });
  await cacheDel(CACHE_KEYS.communityThemes());

  return NextResponse.json({ ok: true });
}
