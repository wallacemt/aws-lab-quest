"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { PixelButton } from "@/components/ui/pixel-button";
import { ACTIVE_TABS, ActiveTab, HistoryTabs } from "@/features/study/components/history/HistoryTabs";
import { fetchQuestHistory, fetchStudyHistory, QuestHistoryItem, StudyHistoryItem } from "@/features/study/services";

export function HistoryScreen() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialTab: ActiveTab = ACTIVE_TABS.includes(tabParam as ActiveTab) ? (tabParam as ActiveTab) : "LAB";
  const initialReviewId = searchParams.get("reviewId") ?? undefined;
  const [labHistory, setLabHistory] = useState<QuestHistoryItem[]>([]);
  const [studyHistory, setStudyHistory] = useState<StudyHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback((isRefresh: boolean) => {
    if (isRefresh) setRefreshing(true);
    setError(null);
    return Promise.all([fetchQuestHistory(), fetchStudyHistory()])
      .then(([labs, study]) => {
        setLabHistory(labs);
        setStudyHistory(study);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Erro ao carregar historico."))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  return (
    <AppLayout>
      <main className="mx-auto w-fit max-w-4xl space-y-6 px-2 py-4 xl:px-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-mono text-sm uppercase text-[var(--pixel-primary)]">Historico</h1>
            <p className="mt-1 font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
              Labs finalizados e sessoes de estudo (KC, Sprint, Simulado, Arena e Quiz Diario)
            </p>
          </div>
          <PixelButton variant="ghost" onClick={() => void load(true)} disabled={loading || refreshing}>
            {refreshing ? "Atualizando..." : "Atualizar"}
          </PixelButton>
        </div>

        <HistoryTabs
          labHistory={labHistory}
          studyHistory={studyHistory}
          loading={loading || refreshing}
          error={error}
          defaultTab={initialTab}
          initialReviewId={initialReviewId}
        />
      </main>
    </AppLayout>
  );
}
