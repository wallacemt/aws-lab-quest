import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const history = await prisma.questHistory.findMany({
    where: { userId: session.user.id },
    orderBy: { completedAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ history });
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    title?: string;
    theme?: string;
    xp?: number;
    tasksCount?: number;
    completedAt?: string;
    certification?: string;
    userName?: string;
  };

  if (!body.title || !body.theme || body.xp == null || !body.tasksCount || !body.completedAt) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const item = await prisma.questHistory.create({
    data: {
      userId: session.user.id,
      title: body.title,
      theme: body.theme,
      xp: body.xp,
      tasksCount: body.tasksCount,
      completedAt: new Date(body.completedAt),
      certification: body.certification ?? "",
      userName: body.userName ?? session.user.name,
    },
  });

  return NextResponse.json({ item }, { status: 201 });
}
