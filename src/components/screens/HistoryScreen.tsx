"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { PixelCard } from "@/components/ui/PixelCard";
import { getTaskXpByDifficulty } from "@/lib/levels";
import { Task } from "@/lib/types";

type HistoryItem = {
  id: string;
  title: string;
  theme: string;
  xp: number;
  tasksCount: number;
  completedAt: string;
  certification: string;
  userName: string;
  sourceLabText?: string | null;
  taskSnapshot?: Task[];
};

const DIFFICULTY_LABEL: Record<"easy" | "medium" | "hard", string> = {
  easy: "Facil",
  medium: "Media",
  hard: "Dificil",
};

function normalizeSnapshot(tasks: Task[] | undefined): Task[] {
  if (!tasks || tasks.length === 0) {
    return [];
  }

  return tasks.map((task, index) => ({
    ...task,
    id: typeof task.id === "number" ? task.id : index + 1,
    difficulty: task.difficulty ?? "medium",
    completed: Boolean(task.completed),
    steps: Array.isArray(task.steps) ? task.steps : [],
  }));
}

export function HistoryScreen() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);

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
              <button key={item.id} type="button" onClick={() => setSelectedItem(item)} className="text-left">
                <PixelCard className="space-y-2 transition-transform hover:-translate-y-[1px] hover:border-[var(--pixel-primary)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-[var(--font-body)] text-base">{item.title}</p>
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
                  <p className="font-[var(--font-pixel)] text-[9px] uppercase text-[var(--pixel-primary)]">
                    Clique para revisar o que foi realizado
                  </p>
                </PixelCard>
              </button>
            ))}
          </div>
        )}

        {selectedItem && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4" role="dialog" aria-modal="true">
            <PixelCard className="max-h-[90vh] w-full max-w-3xl overflow-y-auto space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-[var(--font-pixel)] text-[10px] uppercase text-[var(--pixel-primary)]">
                    Revisao do lab
                  </p>
                  <h2 className="mt-1 font-[var(--font-body)] text-xl">{selectedItem.title}</h2>
                  <p className="mt-1 font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
                    Tema: {selectedItem.theme} · {new Date(selectedItem.completedAt).toLocaleString("pt-BR")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  className="border-2 border-[var(--pixel-border)] bg-[var(--pixel-card)] px-3 py-2 font-[var(--font-pixel)] text-[10px] uppercase hover:bg-[var(--pixel-muted)]"
                >
                  Fechar
                </button>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <span className="border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)] px-2 py-1">
                  +{selectedItem.xp} XP
                </span>
                <span className="border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)] px-2 py-1">
                  {selectedItem.tasksCount} tarefas
                </span>
                {selectedItem.certification && (
                  <span className="border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)] px-2 py-1">
                    {selectedItem.certification}
                  </span>
                )}
              </div>

              {selectedItem.sourceLabText && (
                <div className="space-y-2">
                  <p className="font-[var(--font-pixel)] text-[10px] uppercase text-[var(--pixel-accent)]">
                    Texto base do lab
                  </p>
                  <div className="max-h-48 overflow-auto border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)] p-3">
                    <p className="whitespace-pre-wrap font-[var(--font-body)] text-sm text-[var(--pixel-text)]">
                      {selectedItem.sourceLabText}
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <p className="font-[var(--font-pixel)] text-[10px] uppercase text-[var(--pixel-accent)]">
                  Tarefas realizadas
                </p>
                {normalizeSnapshot(selectedItem.taskSnapshot).length === 0 ? (
                  <div className="border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)] p-3">
                    <p className="font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
                      Este lab foi salvo antes da funcionalidade de snapshot de tarefas.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {normalizeSnapshot(selectedItem.taskSnapshot).map((task, index) => {
                      const difficulty = task.difficulty ?? "medium";
                      return (
                        <div
                          key={`${task.id}-${index}`}
                          className="space-y-2 border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)] p-3"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="font-[var(--font-body)] text-sm">
                                {index + 1}. {task.title}
                              </p>
                              <p className="font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">
                                {task.mission}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              <span className="border border-[var(--pixel-border)] px-2 py-0.5 font-[var(--font-pixel)] text-[8px] uppercase">
                                {DIFFICULTY_LABEL[difficulty]}
                              </span>
                              <span className="border border-[var(--pixel-border)] px-2 py-0.5 font-[var(--font-pixel)] text-[8px] uppercase">
                                +{getTaskXpByDifficulty(difficulty)} XP
                              </span>
                              <span className="border border-[var(--pixel-border)] px-2 py-0.5 font-[var(--font-pixel)] text-[8px] uppercase">
                                {task.completed ? "Concluida" : "Pendente"}
                              </span>
                            </div>
                          </div>
                          {task.steps.length > 0 && (
                            <ul className="space-y-1">
                              {task.steps.map((step) => (
                                <li key={step} className="font-[var(--font-body)] text-xs text-[var(--pixel-text)]">
                                  - {step}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </PixelCard>
          </div>
        )}
      </main>
    </AppLayout>
  );
}
