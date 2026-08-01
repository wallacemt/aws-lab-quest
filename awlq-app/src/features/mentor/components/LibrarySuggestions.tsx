import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ContextualLibrarySuggestions } from "@/features/library/components/ContextualLibrarySuggestions";

/**
 * Server Component — fetches the user's top mentor recommendation and hands
 * its service code off to ContextualLibrarySuggestions, which surfaces at
 * most 3 published library items tagged to that service.
 *
 * Rendered below the recommendation list on the mentor page. If there are no
 * relevant library items, or the user has no recommendations yet, the section
 * is silently omitted (no empty-state noise).
 */
export async function LibrarySuggestions() {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);

  if (!session?.user) return null;

  // Find the highest-priority recommendation that references an AWS service.
  const topRec = await prisma.mentorRecommendation.findFirst({
    where: {
      userId: session.user.id,
      // targetRef holds the service code for review_service action types.
      targetRef: { not: null },
      actionType: "review_service",
    },
    orderBy: { priorityScore: "desc" },
    select: { targetRef: true },
  });

  const serviceCode = topRec?.targetRef ?? null;
  if (!serviceCode) return null;

  return (
    <ContextualLibrarySuggestions
      awsServiceId={serviceCode}
      heading={`Sugestões da Biblioteca — ${serviceCode}`}
    />
  );
}
