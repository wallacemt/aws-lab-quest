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

  return prisma.$transaction(async (tx) => {
    // Re-check inside the transaction: two concurrent callers can both pass
    // the check above, and without this we'd create two ACTIVE journeys.
    const stillActive = await tx.certificationJourney.findFirst({ where: { userId, status: "ACTIVE" } });
    if (stillActive) return stillActive;

    const profile = await tx.userProfile.findUnique({
      where: { userId },
      select: { certificationPresetId: true, certification: true },
    });

    // Reopen a previous journey for the current preset instead of creating a
    // duplicate — same dedup startNewJourney does. Without this, the first
    // activity write after a preset switch (e.g. a KC answer landing before
    // the user ever opens "Nova Jornada" for it) forks a second, empty
    // journey for a certification the user may already have an archived one
    // for, instead of reopening it.
    const existingForPreset = profile?.certificationPresetId
      ? await tx.certificationJourney.findFirst({
          where: { userId, certificationPresetId: profile.certificationPresetId },
          orderBy: { startedAt: "desc" },
        })
      : null;

    if (existingForPreset) {
      return tx.certificationJourney.update({
        where: { id: existingForPreset.id },
        data: { status: "ACTIVE", startedAt: new Date(), endedAt: null },
      });
    }

    return tx.certificationJourney.create({
      data: {
        userId,
        certificationPresetId: profile?.certificationPresetId ?? null,
        certificationLabel: profile?.certification ?? "",
      },
    });
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

    // Reopen a previous journey for the same preset instead of creating a
    // duplicate row — otherwise switching back to a certification you already
    // studied splits its XP/history across two "DVA-C02"-looking entries.
    const existingForPreset = params.certificationPresetId
      ? await tx.certificationJourney.findFirst({
          where: { userId, certificationPresetId: params.certificationPresetId },
          orderBy: { startedAt: "desc" },
        })
      : null;

    const journey = existingForPreset
      ? await tx.certificationJourney.update({
          where: { id: existingForPreset.id },
          data: { status: "ACTIVE", startedAt: new Date(), endedAt: null },
        })
      : await tx.certificationJourney.create({
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
