"use client";

import { useCallback, useEffect, useState } from "react";
import { PixelCard } from "@/components/ui/pixel-card";
import { PixelButton } from "@/components/ui/pixel-button";
import { QuestChainMap } from "@/features/trails/components/QuestChainMap";
import { fetchTrails, type QuestChain, type QuestStage } from "@/features/trails/services/trails-api";

/**
 * Lists all active Quest Chains with per-chain progress and an expandable
 * stage map for each chain.
 */
export function QuestChainScreen() {
  const [chains, setChains] = useState<QuestChain[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedChainId, setExpandedChainId] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<string | null>(null);

  /**
   * Optimistic update after completeStage POST succeeds.
   *
   * Marks the completed stage as done and, if the server reported an
   * unlockedNext id, flips that stage's unlocked flag to true — so the UI
   * responds immediately without a full refetch.
   */
  const handleStageCompleted = useCallback(
    (chainId: string, stageId: string, unlockedNextId: string | undefined) => {
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
    },
    [],
  );

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

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <p className="font-mono text-sm text-[var(--pixel-muted)]">Carregando trilhas...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <p className="font-mono text-sm text-red-500">{error}</p>
        <PixelButton variant="ghost" onClick={() => void load()}>
          Tentar novamente
        </PixelButton>
      </div>
    );
  }

  if (chains.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <p className="font-mono text-sm text-[var(--pixel-muted)]">
          Nenhuma trilha disponível no momento.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6">
      <h1 className="font-mono text-sm uppercase tracking-wide text-[var(--pixel-text)]">
        Trilhas de Aprendizagem
      </h1>

      <div className="space-y-4">
        {chains.map((chain) => {
          const completedCount = chain.stages.filter((s) => s.completed).length;
          const totalCount = chain.stages.length;
          const isExpanded = expandedChainId === chain.id;

          return (
            <PixelCard key={chain.id} className="p-4">
              {/* Chain header */}
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h2 className="font-mono text-sm font-bold text-[var(--pixel-text)]">
                    {chain.name}
                  </h2>
                  {chain.description && (
                    <p className="mt-0.5 font-mono text-xs text-[var(--pixel-muted)]">
                      {chain.description}
                    </p>
                  )}
                  <p className="mt-1 font-mono text-xs text-[var(--pixel-accent)]">
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
                <div className="mt-3 h-1.5 w-full rounded-full bg-[var(--pixel-border)]">
                  <div
                    className="h-full rounded-full bg-[var(--pixel-accent)] transition-all"
                    style={{ width: `${Math.round((completedCount / totalCount) * 100)}%` }}
                  />
                </div>
              )}

              {/* Expanded stage map */}
              {isExpanded && (
                <div className="mt-4 border-t border-[var(--pixel-border)] pt-4">
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
  );
}
