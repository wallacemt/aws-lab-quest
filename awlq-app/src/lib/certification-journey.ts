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

// Read-path counterpart of getOrCreateActiveJourney: never creates a row, just
// resolves which journeyId a history/stats query should scope to. Returns
// undefined when the user has no journey yet (fresh account, no activity) so
// callers can drop the filter from their `where` clause entirely.
export async function resolveJourneyFilter(
  userId: string,
  requestedJourneyId?: string | null
): Promise<string | undefined> {
  if (requestedJourneyId) {
    const requested = await prisma.certificationJourney.findFirst({
      where: { id: requestedJourneyId, userId },
      select: { id: true },
    });
    if (requested) return requested.id;
  }

  const active = await getActiveJourney(userId);
  return active?.id;
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

    const journey = await tx.certificationJourney.create({
      data: {
        userId,
        certificationPresetId: params.certificationPresetId ?? null,
        certificationLabel: params.certificationLabel ?? "",
      },
    });

    // Keep UserProfile.certification in sync so the rest of the app (which
    // reads it directly, e.g. the "Certificação alvo" field) shows the new
    // journey's certification without every consumer needing a rewrite.
    await tx.userProfile.updateMany({
      where: { userId },
      data: {
        certificationPresetId: params.certificationPresetId ?? null,
        certification: params.certificationLabel ?? "",
      },
    });

    return journey;
  });
}
