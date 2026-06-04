import { prisma } from "@/lib/prisma";
import { LibraryScreen } from "@/features/library/screens/LibraryScreen";
import { getContextualLibraryContent } from "@/features/library/services/library-context";
import { ContentCard } from "@/features/library/components/ContentCard";
import type { LibraryContentLite } from "@/features/library/types";

interface BibliotecaPageProps {
  searchParams: Promise<{ serviceCode?: string }>;
}

/**
 * /biblioteca
 *
 * Server Component. Fetches the initial list of published library items
 * directly from the database and passes them to the client screen, avoiding
 * a client-side waterfall on first render.
 *
 * When a `serviceCode` query param is present (e.g. from a mentor library
 * recommendation link), a highlighted "Conteúdo para você" row is shown
 * above the main grid with up to 3 contextually relevant items.
 */
export default async function BibliotecaPage({ searchParams }: BibliotecaPageProps) {
  const { serviceCode } = await searchParams;

  const [items, contextualItems] = await Promise.all([
    prisma.libraryContent.findMany({
      where: { published: true },
      select: {
        id: true,
        type: true,
        title: true,
        description: true,
        category: true,
        authorName: true,
        accessCount: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    serviceCode
      ? getContextualLibraryContent({ awsServiceId: serviceCode })
      : Promise.resolve([] as LibraryContentLite[]),
  ]);

  const content: LibraryContentLite[] = items;

  return (
    <div className="flex flex-col gap-6">
      {contextualItems.length > 0 && (
        <section className="mx-auto w-full max-w-4xl px-4 pt-6">
          <div className="rounded border border-[var(--pixel-accent)]/40 bg-[var(--pixel-accent)]/5 p-4">
            <h2 className="mb-3 font-mono text-xs uppercase tracking-wide text-[var(--pixel-accent)]">
              Conteúdo para você — {serviceCode}
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {contextualItems.map((item) => (
                <ContentCard key={item.id} {...item} />
              ))}
            </div>
          </div>
        </section>
      )}
      <LibraryScreen initialContent={content} />
    </div>
  );
}
