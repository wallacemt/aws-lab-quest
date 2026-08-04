import { NextRequest, NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/user-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireApprovedUser(request);
  if (auth.response) return auth.response;

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
  const take = Math.min(Number(request.nextUrl.searchParams.get("take") ?? 10), 20);

  if (q.length < 2) {
    return NextResponse.json({ users: [] });
  }

  const users = await prisma.user.findMany({
    where: {
      OR: [{ username: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }],
      // Exclude users who have explicitly opted out of public visibility.
      // We achieve this by filtering for users whose profile leaderboardVisible is true,
      // or users who don't have a profile yet (default is visible).
      NOT: {
        profile: { leaderboardVisible: false },
      },
    },
    take,
    orderBy: [{ username: "asc" }],
    select: {
      id: true,
      name: true,
      username: true,
      profile: { select: { avatarUrl: true } },
    },
  });

  return NextResponse.json({
    users: users.map((user) => ({
      id: user.id,
      name: user.name,
      username: user.username,
      avatarUrl: user.profile?.avatarUrl ?? "/default-avatar.png",
    })),
  });
}
