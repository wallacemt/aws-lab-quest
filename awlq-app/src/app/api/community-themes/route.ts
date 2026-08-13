import { NextRequest, NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/user-auth";
import { prisma } from "@/lib/prisma";
import { cacheGetOrSet, CACHE_KEYS, CACHE_TTL } from "@/lib/cache";

type CommunityTheme = {
  id: string;
  name: string;
  colors: Record<string, string>;
  bgImageUrl: string | null;
  createdAt: string;
  authorUsername: string | null;
  authorName: string;
};

export async function GET(request: NextRequest) {
  const auth = await requireApprovedUser(request);
  if (auth.response) return auth.response;

  const themes = await cacheGetOrSet<CommunityTheme[]>(
    CACHE_KEYS.communityThemes(),
    async () => {
      const rows = await prisma.userTheme.findMany({
        where: { isPublic: true },
        orderBy: { createdAt: "desc" },
        // ponytail: search/pagination happen client-side over this list; raise the cap
        // and move filtering server-side if the public gallery ever grows past a few hundred.
        take: 200,
        select: {
          id: true,
          name: true,
          colors: true,
          bgImageUrl: true,
          createdAt: true,
          user: { select: { username: true, name: true } },
        },
      });

      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        colors: row.colors as Record<string, string>,
        bgImageUrl: row.bgImageUrl,
        createdAt: row.createdAt.toISOString(),
        authorUsername: row.user.username,
        authorName: row.user.name,
      }));
    },
    CACHE_TTL.COMMUNITY_THEMES,
  );

  return NextResponse.json({ themes });
}
