"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { CelebrationScreen } from "@/components/ui/celebration-screen";
import { TasksBoard } from "@/components/ui/tasks-board";
import { XPPanel } from "@/components/ui/xp-panel";
import { useQuest } from "@/hooks/useQuest";
import { useUserProfile } from "@/hooks/useUserProfile";

export function QuestScreen() {
  const router = useRouter();
  const { profile, hydrated: userHydrated } = useUserProfile();
  const [dismissedForQuestId, setDismissedForQuestId] = useState<string | null>(null);
  const {
    activeQuest,
    hydrated: questHydrated,
    xp,
    completedCount,
    toggleTask,
    finishQuest,
    clearActiveQuest,
  } = useQuest();

  const allDone = Boolean(activeQuest?.tasks.length && activeQuest.tasks.every((task) => task.completed));
  const dismissKey = activeQuest?.startedAt ?? null;
  const confirmDismissed = Boolean(dismissKey && dismissedForQuestId === dismissKey);

  useEffect(() => {
    if (userHydrated && questHydrated && !activeQuest) {
      router.replace("/");
    }
  }, [activeQuest, questHydrated, router, userHydrated]);

  if (!activeQuest) return null;

  return (
    <AppLayout xp={activeQuest.completed ? 0 : xp} credits creditsCompact>
      <main className="mx-auto grid w-full max-w-[1600px] gap-6 px-4 py-8 xl:grid-cols-[420px_minmax(0,1fr)] xl:px-8">
        <div className="space-y-6 xl:sticky xl:top-24 xl:self-start">
          <XPPanel xp={xp} />
        </div>
        <TasksBoard tasks={activeQuest.tasks} completedCount={completedCount} onToggle={toggleTask} />
      </main>

      {allDone && !activeQuest.completed && !confirmDismissed && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/80 p-4">
          <div className="w-full max-w-lg border-4 border-[var(--pixel-primary)] bg-[var(--pixel-card)] p-6 text-center shadow-[8px_8px_0_0_#000]">
            <p className="font-[var(--font-pixel)] text-xs uppercase text-[var(--pixel-accent)]">
              Todas as tarefas completas
            </p>
            <h2 className="mt-2 font-[var(--font-body)] text-2xl">Finalizar este lab?</h2>
            <p className="mt-2 font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
              Ao finalizar, o XP sera registrado e badges de nivel poderao ser desbloqueados.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => {
                  if (dismissKey) {
                    setDismissedForQuestId(dismissKey);
                  }
                }}
                className="border-2 border-[var(--pixel-border)] bg-[var(--pixel-card)] px-3 py-2 font-[var(--font-pixel)] text-[10px] uppercase hover:bg-[var(--pixel-muted)]"
              >
                Revisar
              </button>
              <button
                onClick={() => finishQuest(profile)}
                className="border-2 border-[var(--pixel-primary)] bg-[var(--pixel-primary)] px-3 py-2 font-[var(--font-pixel)] text-[10px] uppercase text-black hover:brightness-110"
              >
                Sim, Finalizar
              </button>
            </div>
          </div>
        </div>
      )}

      <CelebrationScreen
        open={Boolean(activeQuest.completed)}
        xp={xp}
        theme={activeQuest.theme}
        onRestart={() => {
          clearActiveQuest();
          router.push("/");
        }}
      />
    </AppLayout>
  );
}
