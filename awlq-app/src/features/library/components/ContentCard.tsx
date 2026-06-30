import Link from "next/link";
import type { LibraryContentType } from "@prisma/client";

interface ContentCardProps {
  id: string;
  type: LibraryContentType;
  title: string;
  description?: string | null;
  category: string;
  authorName: string;
  accessCount: number;
}

const TYPE_LABELS: Record<LibraryContentType, string> = {
  PDF: "PDF",
  IMAGE: "Imagem",
  MARKDOWN: "Artigo",
  SLIDES: "Slides",
};

const TYPE_ICONS: Record<LibraryContentType, string> = {
  PDF: "📄",
  IMAGE: "🖼",
  MARKDOWN: "📝",
  SLIDES: "📊",
};

const TYPE_BANNER: Record<LibraryContentType, string> = {
  PDF: "bg-red-950/40 border-b border-red-500/20",
  IMAGE: "bg-blue-950/40 border-b border-blue-500/20",
  MARKDOWN: "bg-green-950/40 border-b border-green-500/20",
  SLIDES: "bg-yellow-950/40 border-b border-yellow-500/20",
};

const TYPE_COLORS: Record<LibraryContentType, string> = {
  PDF: "text-red-400 border-red-400/40",
  IMAGE: "text-blue-400 border-blue-400/40",
  MARKDOWN: "text-green-400 border-green-400/40",
  SLIDES: "text-yellow-400 border-yellow-400/40",
};

export function ContentCard({
  id,
  type,
  title,
  description,
  category,
  authorName,
  accessCount,
}: ContentCardProps) {
  return (
    <Link
      href={`/biblioteca/${id}`}
      className="flex flex-col border border-[var(--pixel-border)] bg-[var(--pixel-card)] overflow-hidden transition-colors hover:border-[var(--pixel-accent)] hover:bg-[var(--pixel-card)]/70"
      title={`${title} — ${TYPE_LABELS[type]}`}
    >
      {/* Preview banner */}
      {/* ponytail: no thumbnail image — list endpoints only return LibraryContentLite
          (no storage URL) because file URLs are presigned per-item on the detail
          route. Rendering real thumbnails here would mean one presigned-URL call
          per card per page load (N+1). Upgrade path: a public thumbnail bucket or
          a batch-presign endpoint, if real previews are needed. */}
      <div className={`flex flex-col items-center justify-center gap-1 h-24 ${TYPE_BANNER[type]}`}>
        <span className="text-5xl" aria-hidden="true">{TYPE_ICONS[type]}</span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--pixel-subtext)]">
          {TYPE_LABELS[type]}
        </span>
      </div>

      {/* Card body */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        {/* Type badge + category */}
        <div className="flex items-center gap-2">
          <span
            className={`border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${TYPE_COLORS[type]}`}
          >
            {TYPE_LABELS[type]}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--pixel-subtext)]">
            {category}
          </span>
        </div>

        {/* Title */}
        <h3 className="font-mono text-sm font-bold text-[var(--pixel-text)] line-clamp-2 flex-1">
          {title}
        </h3>

        {/* Description */}
        {description && (
          <p className="font-mono text-xs text-[var(--pixel-subtext)] line-clamp-2">
            {description}
          </p>
        )}

        {/* Footer: author + access count */}
        <div className="mt-auto flex items-center justify-between pt-2 border-t border-[var(--pixel-border)]/40">
          <span className="font-mono text-[10px] text-[var(--pixel-accent)]">por {authorName}</span>
          <span className="font-mono text-[10px] text-[var(--pixel-subtext)]">
            {accessCount} {accessCount === 1 ? "acesso" : "acessos"}
          </span>
        </div>
      </div>
    </Link>
  );
}
