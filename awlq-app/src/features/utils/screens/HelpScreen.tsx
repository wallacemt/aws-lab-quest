"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { PixelButton } from "@/components/ui/pixel-button";
import { PixelCard } from "@/components/ui/pixel-card";
import { getOnboardingStep, setOnboardingStep } from "@/lib/onboarding";
import { CreatorCredits } from "@/components/ui/creator-credits";
import { FAQ_ITEMS, FaqItem, getYoutubeEmbedUrl, matchesQuery, TOPICS, tutorialShowcase } from "../data/faq-help-data";

export function HelpScreen() {
  const router = useRouter();
  const isOnboardingManual = getOnboardingStep() === "manual";
  const [query, setQuery] = useState("");
  const [activeTopic, setActiveTopic] = useState<string>("Todos");

  function handleContinue() {
    setOnboardingStep("profile");
    router.replace("/profile");
  }

  const filtersActive = query.trim().length > 0 || activeTopic !== "Todos";

  const filteredItems = useMemo(() => {
    return FAQ_ITEMS.filter(
      (item) => (activeTopic === "Todos" || item.topic === activeTopic) && (!query.trim() || matchesQuery(item, query)),
    );
  }, [query, activeTopic]);

  const groupedByTopic = useMemo(() => {
    const map = new Map<string, FaqItem[]>();
    for (const item of filteredItems) {
      map.set(item.topic, [...(map.get(item.topic) ?? []), item]);
    }
    return TOPICS.filter((topic) => map.has(topic)).map((topic) => ({ topic, items: map.get(topic)! }));
  }, [filteredItems]);

  function clearFilters() {
    setQuery("");
    setActiveTopic("Todos");
  }

  return (
    <AppLayout credits creditsCompact>
      <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 xl:px-8">
        <PixelCard className="overflow-hidden bg-[linear-gradient(135deg,var(--pixel-card)_0%,var(--pixel-bg)_100%)]">
          <div className="space-y-4">
            <p className="font-mono text-[10px] uppercase text-[var(--pixel-accent)]">Central de ajuda</p>
            <h1 className="font-mono text-sm uppercase leading-6 text-[var(--pixel-primary)] sm:text-base">
              Perguntas frequentes e tutoriais do AWS Quest
            </h1>
            <p className="max-w-3xl font-[var(--font-body)] text-base leading-7 text-[var(--pixel-text)]">
              Busque pela sua dúvida ou filtre por tópico abaixo. Cada modo do app (Lab, KC, Simulado, Arena, Trilhas e
              mais) tem suas principais perguntas respondidas aqui.
            </p>
          </div>
        </PixelCard>

        {isOnboardingManual && (
          <PixelCard className="space-y-3 border-[var(--pixel-primary)] bg-[var(--pixel-primary)]/10">
            <p className="font-mono text-[10px] uppercase text-[var(--pixel-primary)]">Primeiro acesso</p>
            <p className="font-[var(--font-body)] text-sm leading-6 text-[var(--pixel-text)]">
              Dê uma olhada nas perguntas principais abaixo. Quando terminar, confirme para seguir direto para o perfil
              e completar nome, certificação e tema favorito.
            </p>
            <div className="flex flex-wrap gap-3">
              <PixelButton onClick={handleContinue}>Li e continuar</PixelButton>
            </div>
          </PixelCard>
        )}

        <section className="space-y-4">
          <PixelCard className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--pixel-accent)]">
                Buscar dúvida
              </p>
              {filtersActive && (
                <PixelButton variant="ghost" className="text-[10px]" onClick={clearFilters}>
                  Limpar filtros
                </PixelButton>
              )}
            </div>

            <input
              type="search"
              placeholder="Ex.: como funciona o simulado, conquista, boss..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full border border-[var(--pixel-border)] bg-[var(--pixel-card)] px-3 py-2 font-mono text-xs text-[var(--pixel-text)] placeholder-[var(--pixel-subtext)] focus:border-[var(--pixel-text)] focus:outline-none"
              aria-label="Buscar dúvida"
            />

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveTopic("Todos")}
                className={`border px-3 py-1 font-mono text-xs transition-colors ${
                  activeTopic === "Todos"
                    ? "border-[var(--pixel-accent)] bg-[var(--pixel-accent)] text-[var(--pixel-bg)]"
                    : "border-[var(--pixel-border)] text-[var(--pixel-subtext)] hover:border-[var(--pixel-accent)] hover:text-[var(--pixel-accent)]"
                }`}
              >
                Todos
              </button>
              {TOPICS.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => setActiveTopic(topic)}
                  className={`border px-3 py-1 font-mono text-xs transition-colors ${
                    activeTopic === topic
                      ? "border-[var(--pixel-accent)] bg-[var(--pixel-accent)] text-[var(--pixel-bg)]"
                      : "border-[var(--pixel-border)] text-[var(--pixel-subtext)] hover:border-[var(--pixel-accent)] hover:text-[var(--pixel-accent)]"
                  }`}
                >
                  {topic}
                </button>
              ))}
            </div>
          </PixelCard>

          <p className="font-mono text-[10px] text-[var(--pixel-subtext)]">
            {filteredItems.length} {filteredItems.length === 1 ? "dúvida encontrada" : "dúvidas encontradas"}
            {filtersActive ? " (com filtros ativos)" : ""}
          </p>

          {groupedByTopic.length === 0 ? (
            <PixelCard className="py-8 text-center">
              <p className="font-mono text-sm text-[var(--pixel-subtext)]">
                Nenhuma dúvida encontrada com os filtros selecionados.
              </p>
              <PixelButton variant="ghost" className="mt-3 text-xs" onClick={clearFilters}>
                Limpar filtros
              </PixelButton>
            </PixelCard>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {groupedByTopic.map(({ topic, items }) => (
                <PixelCard key={topic} className="space-y-3">
                  <h2 className="font-mono text-[10px] uppercase tracking-widest text-[var(--pixel-accent)]">
                    {topic}
                  </h2>
                  <div className="divide-y-2 divide-dashed divide-[var(--pixel-border)]">
                    {items.map((item) => (
                      <details key={item.id} className="py-3 first:pt-0 last:pb-0" open={filtersActive}>
                        <summary className="cursor-pointer font-[var(--font-body)] text-sm font-semibold leading-6 text-[var(--pixel-text)] hover:text-[var(--pixel-primary)]">
                          {item.question}
                        </summary>
                        <p className="mt-2 font-[var(--font-body)] text-sm leading-6 text-[var(--pixel-subtext)]">
                          {item.answer}
                        </p>
                      </details>
                    ))}
                  </div>
                </PixelCard>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <PixelCard className="space-y-2">
            <p className="font-mono text-[10px] uppercase text-[var(--pixel-accent)]">Tutoriais em video</p>
            <h2 className="font-mono text-xs uppercase text-[var(--pixel-primary)]">Showcase de fluxos guiados</h2>
            <p className="font-[var(--font-body)] text-sm leading-6 text-[var(--pixel-text)]">
              Assista direto aqui aos videos oficiais de novidades da V2, Lab, KC e Simulado.
            </p>
          </PixelCard>

          <div className="grid gap-4 lg:grid-cols-2">
            {tutorialShowcase.map((tutorial) => {
              const embedUrl = getYoutubeEmbedUrl(tutorial.videoUrl);
              return (
                <PixelCard key={tutorial.id} className="space-y-3">
                  <div className="space-y-2">
                    <h3 className="font-mono text-[10px] uppercase leading-5 text-[var(--pixel-primary)]">
                      {tutorial.title}
                    </h3>
                    <p className="font-[var(--font-body)] text-sm leading-6 text-[var(--pixel-text)]">
                      {tutorial.summary}
                    </p>
                  </div>

                  {embedUrl && (
                    <div
                      className="relative w-full overflow-hidden border-2 border-[var(--pixel-border)]"
                      style={{ paddingTop: "56.25%" }}
                    >
                      <iframe
                        src={embedUrl}
                        title={tutorial.title}
                        className="absolute inset-0 h-full w-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        loading="lazy"
                      />
                    </div>
                  )}

                  <ul className="space-y-1 font-[var(--font-body)] text-xs leading-5 text-[var(--pixel-text)]">
                    {tutorial.highlights.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="pt-[2px] font-mono text-[8px] text-[var(--pixel-accent)]">■</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>

                  <a
                    href={tutorial.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex border-2 border-[var(--pixel-border)] bg-[var(--pixel-card)] px-3 py-2 font-mono text-[10px] uppercase hover:bg-[var(--pixel-muted)]"
                  >
                    Abrir no YouTube
                  </a>
                </PixelCard>
              );
            })}
          </div>
        </section>
        <CreatorCredits compact={false} />
      </main>
    </AppLayout>
  );
}
