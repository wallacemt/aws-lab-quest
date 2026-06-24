import { ChangelogList } from "@/features/changelog/components/ChangelogList";
import { prisma } from "@/lib/prisma";

/**
 * Server Component — fetches changelog data directly from DB.
 * No auth required (public route, RF-16).
 */
export async function ChangelogScreen() {
  const releases = await prisma.changelogRelease.findMany({
    where: { published: true },
    orderBy: { releasedAt: "desc" },
    include: {
      entries: {
        orderBy: { createdAt: "asc" },
        select: { id: true, category: true, text: true },
      },
    },
  });

  const serialized = releases.map((r) => ({
    id: r.id,
    tagName: r.tagName,
    name: r.name,
    bodyMarkdown: r.bodyMarkdown,
    adminSummary: r.adminSummary,
    highlight: r.highlight,
    releasedAt: r.releasedAt?.toISOString() ?? null,
    entries: r.entries,
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-4">
      <div>
        <h1 className="font-mono text-lg font-bold uppercase text-[#f97316]">Changelog</h1>
        <p className="mt-1 font-mono text-xs text-[#94a3b8]">
          Histórico de versões e melhorias da plataforma
        </p>
      </div>
      <ChangelogList releases={serialized} />
    </div>
  );
}
