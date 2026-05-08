import { prisma } from "@/lib/prisma";
import { AWS_CERTIFICATION_PRESETS } from "@/lib/certification-presets";

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
        update: {
          name: preset.name,
          description: preset.description,
          displayOrder: preset.displayOrder,
          examMinutes: preset.examMinutes ?? 90,
          active: true,
        },
      }),
    ),
  );
}

export async function listActiveCertificationPresets() {
  await ensureCertificationPresets();
  return prisma.certificationPreset.findMany({
    where: { active: true },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
  });
}
