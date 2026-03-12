import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.userProfile.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id },
    update: {},
  });

  return NextResponse.json({
    ...profile,
    user: { name: session.user.name, email: session.user.email },
  });
}

export async function PUT(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    name?: string;
    certification?: string;
    favoriteTheme?: string;
  };

  const [updatedUser, updatedProfile] = await prisma.$transaction([
    prisma.user.update({
      where: { id: session.user.id },
      data: { name: body.name ?? session.user.name },
    }),
    prisma.userProfile.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        certification: body.certification ?? "",
        favoriteTheme: body.favoriteTheme ?? "",
      },
      update: {
        certification: body.certification ?? undefined,
        favoriteTheme: body.favoriteTheme ?? undefined,
      },
    }),
  ]);

  return NextResponse.json({
    ...updatedProfile,
    user: { name: updatedUser.name, email: updatedUser.email },
  });
}
