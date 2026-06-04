import { prisma } from "@/lib/prisma";
import type { LibraryContentLite } from "@/features/library/types";

const MAX_CONTEXTUAL_RESULTS = 3;

/**
 * Returns up to 3 published library items relevant to the given context.
 * Used for "Sugestões" blocks on mentor, trail, and weak-area screens.
 *
 * Matches on awsServiceId, questChainId, or weakAreaServiceCode (treated
 * as awsServiceId). At least one filter must be provided; if all are absent
 * the function returns an empty array without hitting the database.
 */
export async function getContextualLibraryContent(opts: {
  awsServiceId?: string;
  questChainId?: string;
  weakAreaServiceCode?: string;
}): Promise<LibraryContentLite[]> {
  const { awsServiceId, questChainId, weakAreaServiceCode } = opts;

  // Collect all service codes that should match (deduplicated).
  const serviceCodes = new Set<string>();
  if (awsServiceId) serviceCodes.add(awsServiceId);
  if (weakAreaServiceCode) serviceCodes.add(weakAreaServiceCode);

  const hasServiceFilter = serviceCodes.size > 0;
  const hasChainFilter = !!questChainId;

  if (!hasServiceFilter && !hasChainFilter) {
    return [];
  }

  const orClauses: { awsServiceId?: { in: string[] }; questChainId?: string }[] = [];
  if (hasServiceFilter) {
    orClauses.push({ awsServiceId: { in: Array.from(serviceCodes) } });
  }
  if (hasChainFilter) {
    orClauses.push({ questChainId });
  }

  const items = await prisma.libraryContent.findMany({
    where: {
      published: true,
      OR: orClauses,
    },
    select: {
      id: true,
      type: true,
      title: true,
      description: true,
      category: true,
      authorName: true,
      accessCount: true,
    },
    orderBy: { accessCount: "desc" },
    take: MAX_CONTEXTUAL_RESULTS,
  });

  return items;
}
