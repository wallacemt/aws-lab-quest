"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { PixelCard } from "@/components/ui/PixelCard";

type HistoryItem = {
  id: string;
  title: string;
  theme: string;
  xp: number;
  tasksCount: number;
  completedAt: string;
  certification: string;
  userName: string;
};

export function HistoryScreen() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/quest-history")
      .then((r) => r.json())
      .then((data: { history?: HistoryItem[]; error?: string }) => {
        if (data.error) throw new Error(data.error);
        setHistory(data.history ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Erro ao carregar histórico."))
      .finally(() => setLoading(false));
  }, []);

  const totalXp = history.reduce((sum, item) => sum + item.xp, 0);

  return (
    <AppLayout>
      <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8 xl:px-8">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-[var(--font-pixel)] text-sm uppercase text-[var(--pixel-primary)]">Histórico</h1>
            <p className="mt-1 font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
              Todos os labs que você completou
            </p>
          </div>
          {history.length > 0 && (
            <div className="border-2 border-[var(--pixel-border)] bg-[var(--pixel-card)] px-3 py-2">
              <span className="font-[var(--font-pixel)] text-[10px] uppercase">
                {history.length} labs · {totalXp} XP total
              </span>
            </div>
          )}
        </div>

        {loading && (
          <PixelCard>
            <p className="font-[var(--font-pixel)] text-xs uppercase text-[var(--pixel-subtext)]">Carregando...</p>
          </PixelCard>
        )}

        {error && (
          <PixelCard className="border-red-500 bg-red-900/20">
            <p className="font-[var(--font-body)] text-sm text-red-300">{error}</p>
          </PixelCard>
        )}

        {!loading && !error && history.length === 0 && (
          <PixelCard className="py-12 text-center">
            <p className="font-[var(--font-pixel)] text-xs uppercase text-[var(--pixel-subtext)]">
              Nenhum quest finalizado ainda.
            </p>
            <p className="mt-3 font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
              Complete seu primeiro lab para aparecer no histórico!
            </p>
          </PixelCard>
        )}

        {!loading && history.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {history.map((item) => (
              <PixelCard key={item.id} className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-[var(--font-body)] text-base font-semibold">{item.title}</p>
                    <p className="font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">Tema: {item.theme}</p>
                  </div>
                  <span className="shrink-0 border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)] px-2 py-1 font-[var(--font-pixel)] text-[10px] uppercase text-[var(--pixel-primary)]">
                    +{item.xp} XP
                  </span>
                </div>

                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--pixel-subtext)]">
                  <span className="font-[var(--font-body)]">{item.tasksCount} tarefas</span>
                  {item.certification && <span className="font-[var(--font-body)]">· {item.certification}</span>}
                  <span className="font-[var(--font-body)]">
                    · {new Date(item.completedAt).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              </PixelCard>
            ))}
          </div>
        )}
      </main>
    </AppLayout>
  );
}
