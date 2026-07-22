type NewsItemData = {
  id: string;
  title: string;
  url: string;
  summary: string | null;
  publishedAt: string | null;
  source: { name: string; category: string };
};

type Props = {
  items: NewsItemData[];
};

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export function NewsList({ items }: Props) {
  if (items.length === 0) {
    return (
      <div className="border border-[var(--pixel-border)] bg-[var(--pixel-card)] p-6 text-center">
        <p className="font-mono text-xs text-[var(--pixel-subtext)]">
          Nenhuma notícia disponível. O worker irá buscar em breve.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <article
          key={item.id}
          className="border border-[var(--pixel-border)] bg-[var(--pixel-card)] p-4 space-y-2 hover:border-[var(--pixel-accent)] transition-colors"
        >
          <div className="flex items-start justify-between gap-3">
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-[var(--font-body)] text-sm font-semibold leading-5 text-[var(--pixel-primary)] hover:underline"
            >
              {/* SECURITY: sanitized on ingestion in news-feed-parser.ts */}
              {item.title}
            </a>
            <span className="shrink-0 font-mono text-[10px] text-[var(--pixel-subtext)]">
              {formatDate(item.publishedAt)}
            </span>
          </div>
          {item.summary && (
            <p className="font-[var(--font-body)] text-xs leading-5 text-[var(--pixel-subtext)] line-clamp-3">
              {item.summary}
            </p>
          )}
          <p className="font-mono text-[10px] uppercase text-accent">{item.source.name}</p>
        </article>
      ))}
    </div>
  );
}
