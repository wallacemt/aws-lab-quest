import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { isAllowedFeedUrl } from "@/lib/url-validation";

type RouteParams = { params: Promise<{ sourceId: string }> };

type UpdateSourceBody = Partial<{
  name: string;
  feedUrl: string;
  category: string;
  active: boolean;
}>;

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { sourceId } = await params;

  let body: UpdateSourceBody;
  try {
    body = (await request.json()) as UpdateSourceBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // LSF-2026-008: reject private/loopback feed URLs to prevent SSRF.
  if (body.feedUrl !== undefined && !isAllowedFeedUrl(body.feedUrl)) {
    return NextResponse.json(
      { error: "feedUrl must be a valid public HTTP/HTTPS URL." },
      { status: 400 },
    );
  }

  const source = await prisma.newsSource.update({
    where: { id: sourceId },
    data: body,
  });

  return NextResponse.json({ source });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { sourceId } = await params;
  await prisma.newsSource.delete({ where: { id: sourceId } });

  return NextResponse.json({ ok: true });
}
