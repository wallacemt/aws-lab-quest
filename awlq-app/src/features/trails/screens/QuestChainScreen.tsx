"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { PixelCard } from "@/components/ui/pixel-card";
import { PixelButton } from "@/components/ui/pixel-button";
import { QuestChainMap } from "@/features/trails/components/QuestChainMap";
import { fetchTrails, type QuestChain, type QuestStage } from "@/features/trails/services/trails-api";

import { LoadingForScreens } from "@/components/ui/loading-screens";
import { ErrorForScreens } from "@/components/ui/error-screens";
import { EmptyForScreens } from "@/components/ui/empty-screens";

// ─── Progress tabs ─────────────────────────────────────────────────────────────

type ChainTab = "IN_PROGRESS" | "NOT_STARTED" | "COMPLETED";

const CHAIN_TABS: { id: ChainTab; label: string }[] = [
  { id: "IN_PROGRESS", label: "Em progresso" },
  { id: "NOT_STARTED", label: "Não iniciadas" },
  { id: "COMPLETED", label: "Concluídas" },
];

function classifyChain(chain: QuestChain): ChainTab {
  const total = chain.stages.length;
  const completedCount = chain.stages.filter((s) => s.completed).length;
  if (total > 0 && completedCount === total) return "COMPLETED";
  if (completedCount > 0) return "IN_PROGRESS";
  return "NOT_STARTED";
}

/**
 * Lists all active Quest Chains with per-chain progress and an expandable
 * stage map for each chain.
 */
export function QuestChainScreen() {
  const searchParams = useSearchParams();
  const [chains, setChains] = useState<QuestChain[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedChainId, setExpandedChainId] = useState<string | null>(searchParams.get("chain"));
  const [tooltip, setTooltip] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ChainTab>("IN_PROGRESS");
  const router = useRouter();
  /**
   * Optimistic update after completeStage POST succeeds.
   *
   * Marks the completed stage as done and, if the server reported an
   * unlockedNext id, flips that stage's unlocked flag to true — so the UI
   * responds immediately without a full refetch.
   */
  const handleStageCompleted = useCallback((chainId: string, stageId: string, unlockedNextId: string | undefined) => {
    setChains((prev) =>
      prev.map((chain) => {
        if (chain.id !== chainId) return chain;

        const updatedStages: QuestStage[] = chain.stages.map((stage) => {
          if (stage.id === stageId) {
            return { ...stage, completed: true, completedAt: new Date().toISOString() };
          }
          if (unlockedNextId && stage.id === unlockedNextId) {
            return { ...stage, unlocked: true };
          }
          return stage;
        });

        return { ...chain, stages: updatedStages };
      }),
    );
  }, []);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setTooltip(null);
    try {
      const data = await fetchTrails();
      setChains(data.chains);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar trilhas.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Deep-linked chain (e.g. from GapReviewScreen's "/trilhas?chain=<id>") may
  // sit in a tab other than the default — jump to whichever tab has it so it's
  // still visible once the map auto-expands.
  useEffect(() => {
    if (!expandedChainId) return;
    const target = chains.find((c) => c.id === expandedChainId);
    if (target) setActiveTab(classifyChain(target));
  }, [chains, expandedChainId]);

  if (isLoading) {
    return <LoadingForScreens text="Carregando trilhas..." />;
  }

  if (error) {
    return (
      <ErrorForScreens
        error={error}
        load={() => {
          void load();
        }}
      />
    );
  }

  if (chains.length === 0) {
    return (
      <EmptyForScreens
        text="Nenhuma trilha disponível ainda. As trilhas de aprendizagem são criadas pelos instrutores e liberadas
                conforme o conteúdo é organizado."
      />
    );
  }

  const chainsByTab: Record<ChainTab, QuestChain[]> = {
    IN_PROGRESS: [],
    NOT_STARTED: [],
    COMPLETED: [],
  };
  for (const chain of chains) {
    chainsByTab[classifyChain(chain)].push(chain);
  }
  const filteredChains = chainsByTab[activeTab];

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl px-4 py-8 flex flex-col gap-6">
        <PixelButton variant="ghost" onClick={() => router.back()}>
          ← Voltar
        </PixelButton>

        <h1 className="font-mono text-sm uppercase tracking-wide text-primary">Trilhas de Aprendizagem</h1>

        {/* Progress tabs */}
        <div className="flex border-2 border-[var(--pixel-border)]">
          {CHAIN_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-4 py-2 font-mono text-[10px] uppercase transition-colors ${
                activeTab === tab.id
                  ? "bg-[var(--pixel-primary)] text-[var(--pixel-bg)]"
                  : "bg-[var(--pixel-card)] text-[var(--pixel-subtext)] hover:bg-[var(--pixel-muted)]"
              }`}
            >
              {tab.label}
              <span className="ml-1 opacity-70">({chainsByTab[tab.id].length})</span>
            </button>
          ))}
        </div>

        {filteredChains.length === 0 && (
          <PixelCard className="py-8 text-center">
            <p className="font-mono text-xs uppercase text-[var(--pixel-subtext)]">
              Nenhuma trilha em &quot;{CHAIN_TABS.find((t) => t.id === activeTab)?.label}&quot; ainda.
            </p>
          </PixelCard>
        )}

        <div className="space-y-4">
          {filteredChains.map((chain) => {
            const completedCount = chain.stages.filter((s) => s.completed).length;
            const totalCount = chain.stages.length;
            const isExpanded = expandedChainId === chain.id;

            return (
              <PixelCard key={chain.id} className="p-4">
                {/* Chain header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h2 className="font-mono text-sm font-bold text-primary">{chain.name}</h2>
                    {chain.description && (
                      <p className="mt-0.5 font-mono text-xs text-pixel-subtext">{chain.description}</p>
                    )}
                    <p className="mt-1 font-mono text-xs text-pixel-subtext">
                      {completedCount}/{totalCount} estágios completos
                    </p>
                  </div>
                  <PixelButton
                    variant="ghost"
                    className="flex-shrink-0 text-xs"
                    onClick={() => {
                      setTooltip(null);
                      setExpandedChainId(isExpanded ? null : chain.id);
                    }}
                  >
                    {isExpanded ? "Fechar" : "Ver mapa"}
                  </PixelButton>
                </div>

                {/* Progress bar */}
                {totalCount > 0 && (
                  <div className="mt-3 h-1.5 w-full rounded-full bg-pixel-border">
                    <div
                      className="h-full rounded-full bg-accent transition-all"
                      style={{ width: `${Math.round((completedCount / totalCount) * 100)}%` }}
                    />
                  </div>
                )}

                {/* Expanded stage map */}
                {isExpanded && (
                  <div className="mt-4 border-t border-pixel-border pt-4">
                    <QuestChainMap
                      chain={chain}
                      tooltip={tooltip}
                      onShowTooltip={setTooltip}
                      onStageCompleted={(stageId, unlockedNextId) =>
                        handleStageCompleted(chain.id, stageId, unlockedNextId)
                      }
                    />
                  </div>
                )}
              </PixelCard>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
