import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { inferCertificationCode } from "@/lib/certification-presets";
import { listActiveCertificationPresets } from "@/lib/certification-service";
import { getProfileValidationError, sanitizeProfileInput } from "@/lib/input-validation";
import { prisma } from "@/lib/prisma";
import { generateUniqueUsername } from "@/lib/username";

async function ensureUserUsername(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { username: true } });
  if (user?.username) return user.username;

  const generated = await generateUniqueUsername();
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { username: generated, lastSeen: new Date() },
    select: { username: true },
  });

  return updated.username ?? generated;
}

async function maybeMigrateCertificationPreset(userId: string) {
  await listActiveCertificationPresets();

  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      certification: true,
      certificationPresetId: true,
    },
  });

  if (!profile || profile.certificationPresetId) {
    return { migrated: false, needsReview: false };
  }

  const inferredCode = inferCertificationCode(profile.certification);
  if (!inferredCode) {
    return {
      migrated: false,
      needsReview: profile.certification.trim().length > 0,
    };
  }

  const preset = await prisma.certificationPreset.findUnique({ where: { code: inferredCode }, select: { id: true } });
  if (!preset) {
    return { migrated: false, needsReview: true };
  }

  await prisma.userProfile.update({
    where: { id: profile.id },
    data: {
      certificationPresetId: preset.id,
    },
  });

  return { migrated: true, needsReview: false };
}

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const username = await ensureUserUsername(session.user.id);
  const migration = await maybeMigrateCertificationPreset(session.user.id);

  const profile = await prisma.userProfile.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id },
    update: {},
    include: {
      certificationPreset: {
        select: {
          code: true,
          name: true,
        },
      },
    },
  });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      username: true,
    },
  });

  return NextResponse.json({
    ...profile,
    user: {
      name: user?.name ?? session.user.name,
      email: user?.email ?? session.user.email,
      username: user?.username ?? username,
    },
    certificationPresetCode: profile.certificationPreset?.code ?? "",
    needsCertificationReview: migration.needsReview,
  });
}

export async function PUT(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    name?: string;
    username?: string;
    certification?: string;
    certificationPresetCode?: string;
    favoriteTheme?: string;
  };
  const sanitizedProfile = sanitizeProfileInput(body);
  const validationError = getProfileValidationError(sanitizedProfile);

  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const certificationPreset = await prisma.certificationPreset.findUnique({
    where: { code: sanitizedProfile.certificationPresetCode },
    select: { id: true, code: true, name: true },
  });

  if (!certificationPreset) {
    return NextResponse.json({ error: "Certificacao selecionada nao encontrada." }, { status: 400 });
  }

  const usernameOwner = await prisma.user.findFirst({
    where: {
      username: sanitizedProfile.username,
      NOT: { id: session.user.id },
    },
    select: { id: true },
  });

  if (usernameOwner) {
    return NextResponse.json({ error: "Nome de usuario indisponivel." }, { status: 409 });
  }

  const [updatedUser, updatedProfile] = await prisma.$transaction([
    prisma.user.update({
      where: { id: session.user.id },
      data: {
        name: sanitizedProfile.name,
        username: sanitizedProfile.username,
        lastSeen: new Date(),
      },
    }),
    prisma.userProfile.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        certification: certificationPreset.name,
        certificationPresetId: certificationPreset.id,
        favoriteTheme: sanitizedProfile.favoriteTheme,
      },
      update: {
        certification: certificationPreset.name,
        certificationPresetId: certificationPreset.id,
        favoriteTheme: sanitizedProfile.favoriteTheme,
      },
      include: {
        certificationPreset: {
          select: {
            code: true,
            name: true,
          },
        },
      },
    }),
  ]);

  return NextResponse.json({
    ...updatedProfile,
    user: {
      name: updatedUser.name,
      email: updatedUser.email,
      username: updatedUser.username,
    },
    certificationPresetCode: updatedProfile.certificationPreset?.code ?? certificationPreset.code,
  });
}
