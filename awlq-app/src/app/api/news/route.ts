import { NextRequest, NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/user-auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/news
 * Returns the latest 20 news items, optionally filtered by source category.
 * Query param: ?category=cloud|devto
 */
export async function GET(request: NextRequest) {
  const auth = await requireApprovedUser(request);
  if (auth.response) return auth.response;

  const category = request.nextUrl.searchParams.get("category");

  // DEF-024: Only return items from active sources so that deactivating a source
  // via the admin panel immediately stops surfacing its items to users.
  const items = await prisma.newsItem.findMany({
    where: {
      source: { active: true, ...(category ? { category } : {}) },
    },
    orderBy: { publishedAt: "desc" },
    take: 20,
    select: {
      id: true,
      title: true,
      url: true,
      summary: true,
      publishedAt: true,
      source: {
        select: { name: true, category: true },
      },
    },
  });

  return NextResponse.json({ items });
}
