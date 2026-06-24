import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/changelog — all releases (published + unpublished)
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const releases = await prisma.changelogRelease.findMany({
    orderBy: { releasedAt: "desc" },
    include: {
      entries: {
        orderBy: { createdAt: "asc" },
        select: { id: true, category: true, text: true },
      },
    },
  });

  return NextResponse.json({ releases });
}
