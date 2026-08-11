import { NextRequest, NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/user-auth";
import { inferCertificationCode } from "@/lib/certification-presets";
import { listActiveCertificationPresets } from "@/lib/certification-service";
import { cacheGetOrSet, cacheDel, CACHE_KEYS, CACHE_TTL } from "@/lib/cache";
import { getProfileValidationError, sanitizeProfileInput } from "@/lib/input-validation";
import { prisma } from "@/lib/prisma";
import { getSignedAvatarUrl } from "@/lib/storage-url";
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
  const auth = await requireApprovedUser(request);
  if (auth.response) return auth.response;

  const userId = auth.user.id;

  const profileData = await cacheGetOrSet(
    CACHE_KEYS.userProfile(userId),
    async () => {
      const username = await ensureUserUsername(userId);
      const migration = await maybeMigrateCertificationPreset(userId);

      const profile = await prisma.userProfile.upsert({
        where: { userId },
        create: { userId },
        update: {},
        include: {
          certificationPreset: { select: { code: true, name: true } },
        },
      });

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          name: true,
          email: true,
          username: true,
          role: true,
          notifyFlashcardEmails: true,
          notifyEngagementEmails: true,
          notifyProductUpdateEmails: true,
        },
      });

      // getSignedAvatarUrl returns null on failure (fail-closed). We fall back
      // to a generic local placeholder so no public storage URL is exposed.
      const resolvedAvatarUrl = await getSignedAvatarUrl(profile?.avatarUrl) ?? "/default-avatar.png";

      return {
        ...profile,
        role: user?.role,
        avatarUrl: resolvedAvatarUrl,
        notifyFlashcardEmails: user?.notifyFlashcardEmails ?? false,
        notifyEngagementEmails: user?.notifyEngagementEmails ?? false,
        notifyProductUpdateEmails: user?.notifyProductUpdateEmails ?? false,
        user: {
          name: user?.name ?? auth.user.name,
          email: user?.email ?? auth.user.email,
          username: user?.username ?? username,
        },
        certificationPresetCode: profile.certificationPreset?.code ?? "",
        needsCertificationReview: migration.needsReview,
      };
    },
    CACHE_TTL.USER_PROFILE,
  );

  return NextResponse.json(profileData);
}

export async function PUT(request: NextRequest) {
  const auth = await requireApprovedUser(request);
  if (auth.response) return auth.response;

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

  // Once a certification is set, trocar de alvo tem que passar por
  // POST /api/journeys (arquiva a jornada atual e abre uma nova) para manter
  // XP/historico separados por certificacao. Aqui so permitimos a primeira
  // definicao (onboarding / migracao de contas antigas sem preset resolvido).
  const existingProfile = await prisma.userProfile.findUnique({
    where: { userId: auth.user.id },
    select: { certificationPresetId: true },
  });

  if (existingProfile?.certificationPresetId && existingProfile.certificationPresetId !== certificationPreset.id) {
    return NextResponse.json(
      { error: "Para trocar de certificacao alvo, inicie uma nova jornada no seu perfil." },
      { status: 409 }
    );
  }

  const usernameOwner = await prisma.user.findFirst({
    where: {
      username: sanitizedProfile.username,
      NOT: { id: auth.user.id },
    },
    select: { id: true },
  });

  if (usernameOwner) {
    return NextResponse.json({ error: "Nome de usuario indisponivel." }, { status: 409 });
  }

  const [updatedUser, updatedProfile] = await prisma.$transaction([
    prisma.user.update({
      where: { id: auth.user.id },
      data: {
        name: sanitizedProfile.name,
        username: sanitizedProfile.username,
        lastSeen: new Date(),
      },
    }),
    prisma.userProfile.upsert({
      where: { userId: auth.user.id },
      create: {
        userId: auth.user.id,
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

  await cacheDel(
    CACHE_KEYS.userProfile(auth.user.id),
    CACHE_KEYS.userPublicProfile(auth.user.id),
  );

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
