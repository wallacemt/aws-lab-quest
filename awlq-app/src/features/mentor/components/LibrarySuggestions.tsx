import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getContextualLibraryContent } from "@/features/library/services/library-context";

const TYPE_LABELS: Record<string, string> = {
  PDF: "PDF",
  IMAGE: "Imagem",
  MARKDOWN: "Artigo",
  SLIDES: "Slides",
};

/**
 * Server Component — fetches the user's top mentor recommendation and
 * surfaces at most 3 published library items tagged to the same AWS service.
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

  const suggestions = await getContextualLibraryContent({ awsServiceId: serviceCode });
  if (suggestions.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-mono text-xs uppercase tracking-wide text-[var(--pixel-muted)]">
        Sugestões da Biblioteca — {serviceCode}
      </h2>
      <ul className="space-y-2">
        {suggestions.map((item) => (
          <li key={item.id}>
            <Link
              href={`/biblioteca/${item.id}`}
              className="flex items-start gap-3 rounded border border-[var(--pixel-border)] bg-[var(--pixel-surface)] p-3 transition-colors hover:border-[var(--pixel-accent)] hover:bg-[var(--pixel-accent)]/5"
            >
              <span className="mt-0.5 flex-shrink-0 font-mono text-[10px] uppercase tracking-wider text-[var(--pixel-accent)]">
                {TYPE_LABELS[item.type] ?? item.type}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-xs font-bold text-[var(--pixel-text)] line-clamp-1">
                  {item.title}
                </p>
                {item.description && (
                  <p className="mt-0.5 font-mono text-[10px] text-[var(--pixel-muted)] line-clamp-1">
                    {item.description}
                  </p>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
