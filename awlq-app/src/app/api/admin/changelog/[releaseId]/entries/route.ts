import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ releaseId: string }> };

type CreateEntryBody = {
  category: string;
  text: string;
};

/**
 * POST /api/admin/changelog/[releaseId]/entries — create an entry
 * DELETE /api/admin/changelog/[releaseId]/entries?entryId=... — delete an entry
 */

export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { releaseId } = await params;

  let body: CreateEntryBody;
  try {
    body = (await request.json()) as CreateEntryBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.category || !body.text) {
    return NextResponse.json({ error: "category and text are required." }, { status: 400 });
  }

  const entry = await prisma.changelogEntry.create({
    data: {
      releaseId,
      category: body.category,
      text: body.text,
    },
  });

  return NextResponse.json({ entry }, { status: 201 });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  await params; // ensure params is awaited

  const entryId = request.nextUrl.searchParams.get("entryId");
  if (!entryId) {
    return NextResponse.json({ error: "entryId query param is required." }, { status: 400 });
  }

  await prisma.changelogEntry.delete({ where: { id: entryId } });
  return NextResponse.json({ ok: true });
}
