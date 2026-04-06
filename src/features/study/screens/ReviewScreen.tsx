"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { PixelButton } from "@/components/ui/pixel-button";
import { PixelCard } from "@/components/ui/pixel-card";
import { fetchWeakServices, WeakServiceItem } from "@/features/study/services";

const REVIEW_GAP_TOP_N = 20;
const REVIEW_ACTION_TOPICS = 5;

function toTopicCode(topic: string): string {
  const cleaned = topic
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .trim();
  return cleaned || topic.toUpperCase();
}

function buildGapLabSeed(topics: string[]): string {
  const bullets = topics.map((topic, index) => `${index + 1}. ${topic}`).join("\n");
  return [
    "Criar laboratorio unico para fechamento de gaps detectados no simulado.",
    "",
    "Topicos prioritarios:",
    bullets,
    "",
    "Estrutura desejada:",
    "- 1 desafio pratico por topico",
    "- validacao objetiva por etapa",
    "- checklist final de consolidacao",
  ].join("\n");
}

export function ReviewScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weakServices, setWeakServices] = useState<WeakServiceItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadWeakServices() {
      setLoading(true);
      setError(null);

      try {
        const items = await fetchWeakServices({ take: REVIEW_GAP_TOP_N, sample: 40 });
        if (!cancelled) {
          setWeakServices(items);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : "Falha ao carregar gaps de conhecimento.");
          setWeakServices([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadWeakServices();

    return () => {
      cancelled = true;
    };
  }, []);

  const priorityTopics = useMemo(
    () =>
      weakServices
        .map((item) => item.serviceCode || item.topic)
        .filter(Boolean)
        .slice(0, REVIEW_ACTION_TOPICS),
    [weakServices],
  );

  return (
    <AppLayout>
      <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 xl:px-8">
        <PixelCard>
          <h1 className="font-mono text-sm uppercase text-[var(--pixel-primary)]">Modo Revisao</h1>
          <p className="mt-2 font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
            Revisao guiada por gaps de conhecimento detectados nos simulados para acelerar sua preparacao.
          </p>
        </PixelCard>

        <PixelCard className="space-y-3 border-[var(--pixel-accent)] bg-[var(--pixel-accent)]/10">
          <p className="font-mono text-[10px] uppercase text-[var(--pixel-accent)]">Gaps priorizados</p>

          {loading && (
            <p className="font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">Analisando seu historico...</p>
          )}

          {!loading && error && <p className="font-[var(--font-body)] text-sm text-red-300">{error}</p>}

          {!loading && !error && weakServices.length === 0 && (
            <p className="font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
              Sem gaps mapeados no momento. Finalize um simulado para gerar recomendacoes personalizadas.
            </p>
          )}

          {!loading && !error && weakServices.length > 0 && (
            <div className="space-y-2">
              {weakServices.map((item) => (
                <div
                  key={`${item.serviceCode}-${item.topic}`}
                  className="border border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2"
                >
                  <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">
                    {item.serviceCode || item.topic}
                  </p>
                  <p className="font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">
                    {item.errors}/{item.attempts} erros ({item.errorRate}%)
                  </p>
                </div>
              ))}
            </div>
          )}
        </PixelCard>

        {!loading && !error && priorityTopics.length > 0 && (
          <PixelCard className="space-y-3">
            <p className="font-mono text-[10px] uppercase text-[var(--pixel-primary)]">Plano de acao</p>
            <p className="font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
              Execute KCs focados e gere Labs unicos para consolidar os topicos mais criticos.
            </p>
            <div className="flex flex-wrap gap-2">
              <PixelButton
                onClick={() =>
                  router.push(`/kc?topics=${encodeURIComponent(priorityTopics.map(toTopicCode).join(","))}`)
                }
              >
                Fazer KC dos gaps
              </PixelButton>
              <PixelButton
                variant="ghost"
                onClick={() =>
                  router.push(
                    `/lab?focus=${encodeURIComponent(priorityTopics.join(", "))}&labText=${encodeURIComponent(buildGapLabSeed(priorityTopics))}`,
                  )
                }
              >
                Criar Lab unico dos gaps
              </PixelButton>
            </div>
          </PixelCard>
        )}
      </main>
    </AppLayout>
  );
}
