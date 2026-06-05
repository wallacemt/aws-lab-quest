import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ releaseId: string }> };

type UpdateReleaseBody = Partial<{
  published: boolean;
  adminSummary: string | null;
  highlight: boolean;
}>;

/**
 * PUT /api/admin/changelog/[releaseId]
 * Toggles published, sets adminSummary, sets highlight.
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
