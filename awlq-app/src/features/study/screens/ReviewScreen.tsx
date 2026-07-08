"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { PixelButton } from "@/components/ui/pixel-button";
import { PixelCard } from "@/components/ui/pixel-card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { fetchWeakServices, WeakServiceItem } from "@/features/study/services";
import { cn } from "@/lib/utils";

const REVIEW_GAP_TOP_N = 20;
const REVIEW_ACTION_TOPICS = 5;

// Visual weight scales with how bad the gap is — worse error rate reads louder.
function gapSeverityClass(errorRate: number): string {
  if (errorRate >= 80) return "border-2 border-[#e74c3c] bg-red-900/30 text-red-300";
  if (errorRate >= 50) return "border border-[#e74c3c]/70 bg-red-900/15 text-red-200";
  return "border border-[var(--pixel-border)] bg-[var(--pixel-bg)] text-[var(--pixel-subtext)]";
}

export function toTopicCode(topic: string): string {
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
        <PixelButton variant="ghost" onClick={() => router.back()}>
          ← Voltar
        </PixelButton>

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
            <TooltipProvider>
              <ScrollArea className="h-72 w-full rounded-md border border-pixel-border">
                <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3">
                  {weakServices.map((item) => {
                    const name = item.serviceCode || item.topic;
                    return (
                      <Tooltip key={`${item.serviceCode}-${item.topic}`}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => {
                              const params = new URLSearchParams({ topic: item.topic });
                              if (item.awsServiceId) params.set("sid", item.awsServiceId);
                              router.push(`/revisao/${encodeURIComponent(name)}?${params.toString()}`);
                            }}
                            className={cn(
                              "flex flex-col gap-1 px-2 py-2 text-left transition hover:border-[var(--pixel-primary)]",
                              gapSeverityClass(item.errorRate),
                            )}
                          >
                            <p className="truncate font-mono text-[10px] font-bold uppercase">{name}</p>
                            <p className="font-[var(--font-body)] text-[11px] opacity-90">
                              {item.errors}/{item.attempts} ({item.errorRate}%)
                            </p>
                            {item.gap && (
                              <p className="font-mono text-[9px] uppercase text-[var(--pixel-accent)]">
                                {item.gap.consecutiveCorrect}/10
                              </p>
                            )}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>Clique para revisar {name}</TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </ScrollArea>
            </TooltipProvider>
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
