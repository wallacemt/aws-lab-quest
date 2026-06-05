type Entry = {
  id: string;
  category: string;
  text: string;
};

type Release = {
  id: string;
  tagName: string;
  name: string | null;
  bodyMarkdown: string | null;
  adminSummary: string | null;
  highlight: boolean;
  releasedAt: string | null;
  entries: Entry[];
};

type Props = {
  release: Release;
};

const CATEGORY_COLORS: Record<string, string> = {
  feature: "text-[#22c55e]",
  fix: "text-[#38bdf8]",
  improvement: "text-[#a78bfa]",
  breaking: "text-[#f87171]",
};

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

export function ReleaseCard({ release }: Props) {
  const displayText = release.adminSummary ?? release.bodyMarkdown ?? null;

  return (
    <article
      className={[
        "border bg-[#0f172a] p-6 space-y-4",
        release.highlight ? "border-[#f97316]" : "border-[#1e293b]",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-[#f97316]">{release.tagName}</span>
            {release.highlight && (
              <span className="border border-[#f97316]/30 px-2 py-0.5 font-mono text-[10px] uppercase text-[#f97316]">
                Destaque
              </span>
            )}
          </div>
          {release.name && (
            <p className="mt-1 font-[var(--font-body)] text-base font-semibold text-[#e2e8f0]">
              {release.name}
            </p>
          )}
        </div>
        {release.releasedAt && (
          <p className="shrink-0 font-mono text-[10px] text-[#94a3b8]">
            {formatDate(release.releasedAt)}
          </p>
        )}
      </div>

      {displayText && (
        <p className="font-[var(--font-body)] text-sm leading-6 text-[#94a3b8]">{displayText}</p>
      )}

      {release.entries.length > 0 && (
        <ul className="space-y-1.5">
          {release.entries.map((entry) => (
            <li key={entry.id} className="flex items-start gap-2 font-mono text-xs">
              <span
                className={[
                  "shrink-0 font-bold uppercase",
                  CATEGORY_COLORS[entry.category] ?? "text-[#cbd5e1]",
                ].join(" ")}
              >
                [{entry.category}]
              </span>
              <span className="text-[#cbd5e1]">{entry.text}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
