"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PixelCard } from "@/components/ui/pixel-card";
import { NewsList } from "@/features/news/components/NewsList";
import { ChangelogList } from "@/features/changelog/components/ChangelogList";
import { PixelButton } from "@/components/ui/pixel-button";
import { useRouter } from "next/navigation";

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

const TABS: { value: Tab; label: string }[] = [
  { value: "noticias", label: "Notícias" },
  { value: "changelog", label: "Changelog do App" },
];

const NEWS_TABS: { value: NewsCategory; label: string; tooltip: string }[] = [
  { value: "all", label: "Todas", tooltip: "Mostrar todas as fontes" },
  { value: "cloud", label: "AWS", tooltip: "Filtrar por blog AWS" },
  { value: "devto", label: "dev.to", tooltip: "Filtrar por dev.to" },
];

// ─── Screen ───────────────────────────────────────────────────────────────────

export function NewsAndChangelogScreen() {
  const [activeTab, setActiveTab] = useState<Tab>("noticias");

  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [newsCategory, setNewsCategory] = useState<NewsCategory>("all");

  const [changelogReleases, setChangelogReleases] = useState<ChangelogRelease[] | null>(null);
  const [changelogLoading, setChangelogLoading] = useState(false);
  const [changelogError, setChangelogError] = useState<string | null>(null);
  const router = useRouter();
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
      "border px-4 py-1.5 font-mono text-xs uppercase transition-colors",
      isActive
        ? "border-[var(--pixel-primary)] bg-[var(--pixel-primary)]/10 text-[var(--pixel-primary)]"
        : "border-[var(--pixel-border)] text-[var(--pixel-subtext)] hover:border-[var(--pixel-accent)] hover:text-[var(--pixel-accent)]",
    ].join(" ");

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
        <PixelButton variant="ghost" onClick={() => router.back()}>
          ← Voltar
        </PixelButton>
        {/* Header */}
        <PixelCard>
          <h1 className="font-mono text-sm uppercase text-[var(--pixel-primary)]">Novidades</h1>
          <p className="mt-1 font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
            Últimas notícias da AWS e atualizações da plataforma.
          </p>
        </PixelCard>

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
                  title={tab.tooltip}
                  onClick={() => setNewsCategory(tab.value)}
                  className={tabBtnClass(newsCategory === tab.value)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {newsLoading && (
              <PixelCard className="text-center py-8">
                <p className="font-mono text-xs uppercase text-[var(--pixel-subtext)]">Buscando notícias...</p>
              </PixelCard>
            )}

            {newsError && !newsLoading && (
              <PixelCard className="border-red-500/40 bg-red-950/10">
                <p className="font-mono text-xs text-red-400">{newsError}</p>
              </PixelCard>
            )}

            {!newsLoading && !newsError && newsItems.length === 0 && (
              <PixelCard className="text-center">
                <p className="font-mono text-xs text-[var(--pixel-accent)]">
                  Nenhuma notícia disponível. O worker irá buscar em breve.
                </p>
              </PixelCard>
            )}

            {!newsLoading && !newsError && newsItems.length > 0 && <NewsList items={newsItems} />}
          </div>
        )}

        {/* Changelog tab */}
        {activeTab === "changelog" && (
          <div className="space-y-4">
            {changelogLoading && (
              <PixelCard className="text-center py-8">
                <p className="font-mono text-xs uppercase text-[var(--pixel-subtext)]">Carregando changelog...</p>
              </PixelCard>
            )}

            {changelogError && !changelogLoading && (
              <PixelCard className="border-red-500/40 bg-red-950/10">
                <p className="font-mono text-xs text-red-400">{changelogError}</p>
              </PixelCard>
            )}

            {!changelogLoading &&
              !changelogError &&
              changelogReleases !== null &&
              (changelogReleases.length === 0 ? (
                <PixelCard className="text-center">
                  <p className="font-mono text-xs text-[var(--pixel-muted)]">Nenhuma release publicada ainda.</p>
                </PixelCard>
              ) : (
                <ChangelogList releases={changelogReleases} />
              ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
