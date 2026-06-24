"use client";

import { useEffect, useState } from "react";
import { NewsList } from "@/features/news/components/NewsList";

type NewsItem = {
  id: string;
  title: string;
  url: string;
  summary: string | null;
  publishedAt: string | null;
  source: { name: string; category: string };
};

type Category = "all" | "cloud" | "devto";

export function NewsScreen() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<Category>("all");

  useEffect(() => {
    // Wrapping in an async function avoids calling setState synchronously in the
    // effect body, which would trigger the react-hooks/set-state-in-effect rule.
    async function load() {
      setLoading(true);
      setError(null);
      const url = category === "all" ? "/api/news" : `/api/news?category=${category}`;
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("Erro ao buscar notícias");
        const data = (await res.json()) as { items: NewsItem[] };
        setItems(data.items);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Erro ao buscar notícias");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [category]);

  const TABS: { value: Category; label: string }[] = [
    { value: "all", label: "Todas" },
    { value: "cloud", label: "AWS" },
    { value: "devto", label: "dev.to" },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      <div>
        <h1 className="font-mono text-lg font-bold uppercase text-[#f97316]">Notícias</h1>
        <p className="mt-1 font-mono text-xs text-[#94a3b8]">Últimas novidades da comunidade AWS</p>
      </div>

      <div className="flex gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setCategory(tab.value)}
            className={[
              "border px-3 py-1.5 font-mono text-xs uppercase transition-colors",
              category === tab.value
                ? "border-[#f97316] text-[#f97316]"
                : "border-[#1e293b] text-[#94a3b8] hover:border-[#334155]",
            ].join(" ")}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="grid place-items-center py-12">
          <p className="font-mono text-xs uppercase text-[#94a3b8]">Buscando notícias...</p>
        </div>
      )}

      {error && (
        <div className="border border-red-500/30 bg-[#1a0a0a] p-3">
          <p className="font-mono text-xs text-red-400">{error}</p>
        </div>
      )}

      {!loading && !error && <NewsList items={items} />}
    </div>
  );
}
