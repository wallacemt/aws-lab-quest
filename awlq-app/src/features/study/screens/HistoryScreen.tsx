"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PixelCard } from "@/components/ui/pixel-card";
import { HistoryTabs } from "@/features/study/components/history/HistoryTabs";
import { fetchQuestHistory, fetchStudyHistory, QuestHistoryItem, StudyHistoryItem } from "@/features/study/services";

export function HistoryScreen() {
  const [labHistory, setLabHistory] = useState<QuestHistoryItem[]>([]);
  const [studyHistory, setStudyHistory] = useState<StudyHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchQuestHistory(), fetchStudyHistory()])
      .then(([labs, study]) => {
        setLabHistory(labs);
        setStudyHistory(study);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Erro ao carregar historico."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppLayout>
      <main className="mx-auto w-fit max-w-4xl space-y-6 px-2 py-4 xl:px-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-mono text-sm uppercase text-[var(--pixel-primary)]">Historico</h1>
            <p className="mt-1 font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
              Labs finalizados e sessoes de estudo (KC e Simulado)
            </p>
          </div>
        </div>

        {loading && (
          <PixelCard>
            <p className="font-mono text-xs uppercase text-[var(--pixel-subtext)]">Carregando...</p>
          </PixelCard>
        )}

        {!loading && (
          <HistoryTabs labHistory={labHistory} studyHistory={studyHistory} error={error} />
        )}
      </main>
    </AppLayout>
  );
}
