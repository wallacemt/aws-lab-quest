import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { isAllowedFeedUrl } from "@/lib/url-validation";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const sources = await prisma.newsSource.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json({ sources });
}

type CreateSourceBody = {
  name: string;
  feedUrl: string;
  category?: string;
  active?: boolean;
};

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  let body: CreateSourceBody;
  try {
    body = (await request.json()) as CreateSourceBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.name || !body.feedUrl) {
    return NextResponse.json({ error: "name and feedUrl are required." }, { status: 400 });
  }

  // LSF-2026-008: reject private/loopback feed URLs to prevent SSRF.
  if (!isAllowedFeedUrl(body.feedUrl)) {
    return NextResponse.json(
      { error: "feedUrl must be a valid public HTTP/HTTPS URL." },
      { status: 400 },
    );
  }

  const source = await prisma.newsSource.create({
    data: {
      name: body.name,
      feedUrl: body.feedUrl,
      category: body.category ?? "cloud",
      active: body.active ?? true,
    },
  });

  return NextResponse.json({ source }, { status: 201 });
}
