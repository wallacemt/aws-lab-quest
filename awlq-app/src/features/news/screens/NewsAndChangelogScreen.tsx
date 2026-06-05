"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { NewsList } from "@/features/news/components/NewsList";
import { ChangelogList } from "@/features/changelog/components/ChangelogList";

// ─── Types ────────────────────────────────────────────────────────────────────

type NewsItem = {
  id: string;
  title: string;
  url: string;
  summary: string | null;
  publishedAt: string | null;
  source: { name: string; category: string };
};

type ChangelogEntry = {
  id: string;
  category: string;
  text: string;
};

type ChangelogRelease = {
  id: string;
  tagName: string;
  name: string | null;
  bodyMarkdown: string | null;
  adminSummary: string | null;
  highlight: boolean;
  releasedAt: string | null;
  entries: ChangelogEntry[];
};

type NewsCategory = "all" | "cloud" | "devto";
type Tab = "noticias" | "changelog";

// ─── Tab constants ────────────────────────────────────────────────────────────

const TABS: { value: Tab; label: string }[] = [
  { value: "noticias", label: "Notícias" },
  { value: "changelog", label: "Changelog do App" },
];

const NEWS_TABS: { value: NewsCategory; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "cloud", label: "AWS" },
  { value: "devto", label: "dev.to" },
];

// ─── Screen ───────────────────────────────────────────────────────────────────

export function NewsAndChangelogScreen() {
  const [activeTab, setActiveTab] = useState<Tab>("noticias");

  // News state
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [newsCategory, setNewsCategory] = useState<NewsCategory>("all");

  // Changelog state (loaded lazily on first tab click)
  const [changelogReleases, setChangelogReleases] = useState<ChangelogRelease[] | null>(null);
  const [changelogLoading, setChangelogLoading] = useState(false);
  const [changelogError, setChangelogError] = useState<string | null>(null);

  // Wrapping in an async function avoids calling setState synchronously in the
  // effect body, which would trigger the react-hooks/set-state-in-effect rule.
  useEffect(() => {
    async function loadNews() {
      setNewsLoading(true);
      setNewsError(null);
      const url = newsCategory === "all" ? "/api/news" : `/api/news?category=${newsCategory}`;
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("Erro ao buscar notícias");
        const data = (await res.json()) as { items: NewsItem[] };
        setNewsItems(data.items);
      } catch (err: unknown) {
        setNewsError(err instanceof Error ? err.message : "Erro ao buscar notícias");
      } finally {
        setNewsLoading(false);
      }
    }
    void loadNews();
  }, [newsCategory]);

  // Lazy-load changelog when tab is first activated
  function handleTabClick(tab: Tab) {
    setActiveTab(tab);
    if (tab === "changelog" && changelogReleases === null && !changelogLoading) {
      loadChangelog();
    }
  }

  function loadChangelog() {
    setChangelogLoading(true);
    setChangelogError(null);

    fetch("/api/changelog")
      .then(async (res) => {
        if (!res.ok) throw new Error("Erro ao buscar changelog");
        const data = (await res.json()) as { releases: ChangelogRelease[] };
        setChangelogReleases(data.releases);
      })
      .catch((err: unknown) => {
        setChangelogError(err instanceof Error ? err.message : "Erro ao buscar changelog");
      })
      .finally(() => setChangelogLoading(false));
  }

  const tabBtnClass = (isActive: boolean) =>
    [
      "border px-3 py-1.5 font-mono text-xs uppercase transition-colors",
      isActive
        ? "border-[var(--pixel-primary)] text-[var(--pixel-primary)]"
        : "border-[var(--pixel-border)] text-[var(--pixel-muted)] hover:border-[var(--pixel-border)]/60",
    ].join(" ");

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="font-mono text-lg font-bold uppercase text-[var(--pixel-primary)]">
            Novidades
          </h1>
        </div>

        {/* Primary tab bar */}
        <div className="flex gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => handleTabClick(tab.value)}
              className={tabBtnClass(activeTab === tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Notícias tab */}
        {activeTab === "noticias" && (
          <div className="space-y-4">
            {/* Category filter */}
            <div className="flex gap-2">
              {NEWS_TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setNewsCategory(tab.value)}
                  className={tabBtnClass(newsCategory === tab.value)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {newsLoading && (
              <div className="grid place-items-center py-12">
                <p className="font-mono text-xs uppercase text-[var(--pixel-muted)]">
                  Buscando notícias...
                </p>
              </div>
            )}

            {newsError && !newsLoading && (
              <div className="border border-red-500/30 bg-red-950/20 p-3">
                <p className="font-mono text-xs text-red-400">{newsError}</p>
              </div>
            )}

            {!newsLoading && !newsError && newsItems.length === 0 && (
              <div className="border border-[var(--pixel-border)] bg-[var(--pixel-bg)] p-6 text-center">
                <p className="font-mono text-xs text-[var(--pixel-muted)]">
                  Nenhuma notícia disponível. O worker irá buscar em breve.
                </p>
              </div>
            )}

            {!newsLoading && !newsError && newsItems.length > 0 && (
              <NewsList items={newsItems} />
            )}
          </div>
        )}

        {/* Changelog tab */}
        {activeTab === "changelog" && (
          <div className="space-y-4">
            {changelogLoading && (
              <div className="grid place-items-center py-12">
                <p className="font-mono text-xs uppercase text-[var(--pixel-muted)]">
                  Carregando changelog...
                </p>
              </div>
            )}

            {changelogError && !changelogLoading && (
              <div className="border border-red-500/30 bg-red-950/20 p-3">
                <p className="font-mono text-xs text-red-400">{changelogError}</p>
              </div>
            )}

            {!changelogLoading && !changelogError && changelogReleases !== null && (
              changelogReleases.length === 0 ? (
                <div className="border border-[var(--pixel-border)] bg-[var(--pixel-bg)] p-6 text-center">
                  <p className="font-mono text-xs text-[var(--pixel-muted)]">
                    Nenhuma release publicada ainda.
                  </p>
                </div>
              ) : (
                <ChangelogList releases={changelogReleases} />
              )
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
