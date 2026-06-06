import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ releaseId: string }> };

type UpdateReleaseBody = Partial<{
  published: boolean;
  adminSummary: string | null;
  highlight: boolean;
  bodyMarkdown: string | null;
}>;

/**
 * PUT /api/admin/changelog/[releaseId]
 * Toggles published, sets adminSummary, highlight, and bodyMarkdown.
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { releaseId } = await params;

  let body: UpdateReleaseBody;
  try {
    body = (await request.json()) as UpdateReleaseBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const release = await prisma.changelogRelease.update({
    where: { id: releaseId },
    data: body,
  });

  return NextResponse.json({ release });
}

/**
 * DELETE /api/admin/changelog/[releaseId]
 * Permanently removes a release and its entries.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { releaseId } = await params;

  await prisma.changelogRelease.delete({ where: { id: releaseId } });

  return NextResponse.json({ deleted: true });
}
