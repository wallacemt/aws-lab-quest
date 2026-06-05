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
      <div className="border border-[#1e293b] bg-[#0f172a] p-6 text-center">
        <p className="font-mono text-xs text-[#94a3b8]">
          Nenhuma notícia disponível. O worker irá buscar em breve.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <article key={item.id} className="border border-[#1e293b] bg-[#0f172a] p-4 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-[var(--font-body)] text-sm font-semibold leading-5 text-[#38bdf8] hover:underline"
            >
              {/* SECURITY: sanitized on ingestion in news-feed-parser.ts */}
              {item.title}
            </a>
            <span className="shrink-0 font-mono text-[10px] text-[#94a3b8]">
              {formatDate(item.publishedAt)}
            </span>
          </div>
          {item.summary && (
            <p className="font-[var(--font-body)] text-xs leading-5 text-[#94a3b8] line-clamp-3">
              {item.summary}
            </p>
          )}
          <p className="font-mono text-[10px] uppercase text-[#475569]">{item.source.name}</p>
        </article>
      ))}
    </div>
  );
}
