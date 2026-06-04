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
      className="block rounded border border-[var(--pixel-border)] bg-[var(--pixel-surface)] p-4 transition-colors hover:border-[var(--pixel-accent)] hover:bg-[var(--pixel-accent)]/5"
    >
      {/* Type badge + category */}
      <div className="mb-2 flex items-center gap-2">
        <span
          className={`rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${TYPE_COLORS[type]}`}
        >
          {TYPE_LABELS[type]}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--pixel-muted)]">
          {category}
        </span>
      </div>

      {/* Title */}
      <h3 className="font-mono text-sm font-bold text-[var(--pixel-text)] line-clamp-2">
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p className="mt-1 font-mono text-xs text-[var(--pixel-muted)] line-clamp-2">
          {description}
        </p>
      )}

      {/* Footer: author + access count */}
      <div className="mt-3 flex items-center justify-between">
        <span className="font-mono text-[10px] text-[var(--pixel-muted)]">por {authorName}</span>
        <span className="font-mono text-[10px] text-[var(--pixel-muted)]">
          {accessCount} {accessCount === 1 ? "acesso" : "acessos"}
        </span>
      </div>
    </Link>
  );
}
