"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
  feature: "text-[var(--pixel-accent)]",
  fix: "text-[var(--pixel-primary)]",
  improvement: "text-purple-400",
  breaking: "text-red-400",
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
        "border bg-[var(--pixel-card)] p-6 space-y-4",
        release.highlight
          ? "border-[var(--pixel-primary)] retro-shadow"
          : "border-[var(--pixel-border)]",
      ].join(" ")}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-[var(--pixel-primary)]">{release.tagName}</span>
            {release.highlight && (
              <span className="border border-[var(--pixel-primary)]/40 px-2 py-0.5 font-mono text-[10px] uppercase text-[var(--pixel-primary)]">
                Destaque
              </span>
            )}
          </div>
          {release.name && (
            <p className="mt-1 font-[var(--font-body)] text-base font-semibold text-[var(--pixel-text)]">
              {release.name}
            </p>
          )}
        </div>
        {release.releasedAt && (
          <p className="shrink-0 font-mono text-[10px] text-[var(--pixel-subtext)]">
            {formatDate(release.releasedAt)}
          </p>
        )}
      </div>

      {/* Body — rendered as markdown */}
      {displayText && (
        <div className="text-[var(--pixel-subtext)]">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => (
                <h1 className="mb-2 font-mono text-sm uppercase text-[var(--pixel-primary)]">{children}</h1>
              ),
              h2: ({ children }) => (
                <h2 className="mb-2 mt-3 font-mono text-xs uppercase text-[var(--pixel-accent)]">{children}</h2>
              ),
              h3: ({ children }) => (
                <h3 className="mb-1 mt-2 font-mono text-[11px] uppercase text-[var(--pixel-subtext)]">{children}</h3>
              ),
              p: ({ children }) => (
                <p className="mb-2 font-[var(--font-body)] text-sm leading-6 text-[var(--pixel-subtext)]">{children}</p>
              ),
              li: ({ children }) => (
                <li className="mb-1 ml-4 list-disc font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
                  {children}
                </li>
              ),
              ul: ({ children }) => <ul className="mb-2 space-y-0.5">{children}</ul>,
              ol: ({ children }) => <ol className="mb-2 space-y-0.5 list-decimal ml-4">{children}</ol>,
              strong: ({ children }) => (
                <strong className="font-semibold text-[var(--pixel-text)]">{children}</strong>
              ),
              code: ({ children }) => (
                <code className="rounded bg-[var(--pixel-border)]/30 px-1 py-0.5 font-mono text-xs text-[var(--pixel-accent)]">
                  {children}
                </code>
              ),
              a: ({ href, children }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--pixel-primary)] underline hover:opacity-80"
                >
                  {children}
                </a>
              ),
            }}
          >
            {displayText}
          </ReactMarkdown>
        </div>
      )}

      {/* Manual entries */}
      {release.entries.length > 0 && (
        <ul className="space-y-1.5 border-t border-[var(--pixel-border)] pt-3">
          {release.entries.map((entry) => (
            <li key={entry.id} className="flex items-start gap-2 font-mono text-xs">
              <span
                className={[
                  "shrink-0 font-bold uppercase",
                  CATEGORY_COLORS[entry.category] ?? "text-[var(--pixel-subtext)]",
                ].join(" ")}
              >
                [{entry.category}]
              </span>
              <span className="text-[var(--pixel-subtext)]">{entry.text}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
