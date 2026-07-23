import { Prisma } from "@prisma/client";
import { expandServiceCodes } from "@/lib/aws-service-codes";

// Single source of truth for "which questions belong to this boss's pool" — used both to
// serve questions to the player (bosses/[bossId]/questions) and to authorise submitted
// answers during scoring (arena/battle). The two MUST stay identical: if scoring uses a
// narrower filter than the one that served the question, a legitimately-displayed question
// gets silently rejected as "unauthorised" and a correct answer scores as a miss.
export function buildBossQuestionPoolWhere(
  themeService: string,
  serviceName: string | null,
  certificationPresetId?: string | null,
): Prisma.StudyQuestionWhereInput {
  const expandedCodes = expandServiceCodes([themeService]);
  const serviceOr: Prisma.StudyQuestionWhereInput[] = [
    { awsService: { code: { in: expandedCodes } } },
    { questionAwsServices: { some: { service: { code: { in: expandedCodes } } } } },
  ];
  if (serviceName) {
    serviceOr.push({ statement: { contains: serviceName, mode: "insensitive" } });
    serviceOr.push({ topic: { contains: serviceName, mode: "insensitive" } });
  }

  return {
    active: true,
    questionType: "single",
    OR: serviceOr,
    ...(certificationPresetId ? { certificationPresetId } : {}),
  };
}
