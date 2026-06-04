interface AuthorCreditProps {
  authorName: string;
  authorUrl?: string | null;
  authorContact?: string | null;
}

/**
 * Displays the author's name prominently with optional website and contact
 * links. RF-13 requires author attribution to be clearly visible on every
 * content detail page.
 *
 * Defense-in-depth: only renders a clickable link when the URL uses a safe
 * http/https scheme. A stored javascript: URI would otherwise execute when
 * the user clicks the link (LSF-2026-013).
 */
export function AuthorCredit({ authorName, authorUrl, authorContact }: AuthorCreditProps) {
  const safeUrl =
    authorUrl &&
    (authorUrl.startsWith("https://") || authorUrl.startsWith("http://"))
      ? authorUrl
      : null;

  return (
    <div className="flex flex-col gap-1 rounded border border-[var(--pixel-accent)] bg-[var(--pixel-accent)]/5 px-4 py-3">
      <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--pixel-accent)]">
        Criado por
      </p>
      <p className="font-mono text-sm font-bold text-[var(--pixel-text)]">{authorName}</p>

      <div className="flex flex-wrap gap-3">
        {authorUrl && (
          safeUrl ? (
            <a
              href={safeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs text-[var(--pixel-accent)] underline hover:opacity-80"
            >
              {safeUrl}
            </a>
          ) : (
            <span className="font-mono text-xs text-[var(--pixel-muted)]">{authorUrl}</span>
          )
        )}
        {authorContact && (
          <span className="font-mono text-xs text-[var(--pixel-muted)]">{authorContact}</span>
        )}
      </div>
    </div>
  );
}
