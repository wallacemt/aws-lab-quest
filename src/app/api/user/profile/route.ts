import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getProfileValidationError, sanitizeProfileInput } from "@/lib/input-validation";
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
  const sanitizedProfile = sanitizeProfileInput(body);
  const validationError = getProfileValidationError(sanitizedProfile);

  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const [updatedUser, updatedProfile] = await prisma.$transaction([
    prisma.user.update({
      where: { id: session.user.id },
      data: { name: sanitizedProfile.name },
    }),
    prisma.userProfile.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        certification: sanitizedProfile.certification,
        favoriteTheme: sanitizedProfile.favoriteTheme,
      },
      update: {
        certification: sanitizedProfile.certification,
        favoriteTheme: sanitizedProfile.favoriteTheme,
      },
    }),
  ]);

  return NextResponse.json({
    ...updatedProfile,
    user: { name: updatedUser.name, email: updatedUser.email },
  });
}
