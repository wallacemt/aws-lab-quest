import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
  const take = Math.min(Number(request.nextUrl.searchParams.get("take") ?? 10), 20);

  if (q.length < 2) {
    return NextResponse.json({ users: [] });
  }

  const users = await prisma.user.findMany({
    where: {
      OR: [{ username: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }],
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
      avatarUrl: user.profile?.avatarUrl ?? null,
    })),
  });
}
