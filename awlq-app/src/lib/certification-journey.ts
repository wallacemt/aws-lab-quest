import { prisma } from "@/lib/prisma";
import type { CertificationJourney } from "@prisma/client";

export async function getActiveJourney(userId: string): Promise<CertificationJourney | null> {
  return prisma.certificationJourney.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { startedAt: "desc" },
  });
}

export async function listJourneys(userId: string): Promise<CertificationJourney[]> {
  return prisma.certificationJourney.findMany({
    where: { userId },
    orderBy: { startedAt: "desc" },
  });
}

// Lazily opens a journey for users who existed before this feature (or whose
// backfill row is somehow missing) so activity-writing routes never need to
// special-case "no journey yet" — they just call this and stamp the id.
export async function getOrCreateActiveJourney(userId: string): Promise<CertificationJourney> {
  const existing = await getActiveJourney(userId);
  if (existing) return existing;

  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    select: { certificationPresetId: true, certification: true },
  });

  return prisma.certificationJourney.create({
    data: {
      userId,
      certificationPresetId: profile?.certificationPresetId ?? null,
      certificationLabel: profile?.certification ?? "",
    },
  });
}

export async function startNewJourney(
  userId: string,
  params: { certificationPresetId?: string | null; certificationLabel?: string }
): Promise<CertificationJourney> {
  return prisma.$transaction(async (tx) => {
    await tx.certificationJourney.updateMany({
      where: { userId, status: "ACTIVE" },
      data: { status: "ARCHIVED", endedAt: new Date() },
    });

    return tx.certificationJourney.create({
      data: {
        userId,
        certificationPresetId: params.certificationPresetId ?? null,
        certificationLabel: params.certificationLabel ?? "",
      },
    });
  });
}
