import { prisma } from "@/lib/prisma";
import { AWS_CERTIFICATION_PRESETS } from "@/lib/certification-presets";
import { cacheGetOrSet, cacheDel, CACHE_KEYS, CACHE_TTL } from "@/lib/cache";

// Seeds certifications from the hardcoded list on first run only — the `update`
// branch is a no-op so an existing row is never touched. Admin edits made via
// /admin/certificacoes (name, description, examMinutes, active, displayOrder)
// are the source of truth after that; re-applying the seed values here on every
// cache miss would silently revert them.
export async function ensureCertificationPresets() {
  await prisma.$transaction(
    AWS_CERTIFICATION_PRESETS.map((preset) =>
      prisma.certificationPreset.upsert({
        where: { code: preset.code },
        create: {
          code: preset.code,
          name: preset.name,
          description: preset.description,
          displayOrder: preset.displayOrder,
          examMinutes: preset.examMinutes ?? 90,
          active: true,
        },
        update: {},
      }),
    ),
  );
}

export async function listActiveCertificationPresets() {
  return cacheGetOrSet(
    CACHE_KEYS.certifications(),
    async () => {
      await ensureCertificationPresets();
      return prisma.certificationPreset.findMany({
        where: { active: true },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      });
    },
    CACHE_TTL.CERTIFICATIONS,
  );
}

export async function invalidateCertificationsCache(): Promise<void> {
  await cacheDel(CACHE_KEYS.certifications());
}
