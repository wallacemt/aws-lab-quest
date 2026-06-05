import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/changelog
 * Public route — no auth required (RF-16).
 * Returns published releases ordered by releasedAt descending, with entries.
 */
export async function GET() {
  const releases = await prisma.changelogRelease.findMany({
    where: { published: true },
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
