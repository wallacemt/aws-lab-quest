"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { ErrorForScreens } from "@/components/ui/error-screens";
import { LoadingForScreens } from "@/components/ui/loading-screens";
import { PixelButton } from "@/components/ui/pixel-button";
import { PixelCard } from "@/components/ui/pixel-card";
import { SprintRunner } from "@/features/retention/components/SprintRunner";
import { useSprint } from "@/features/retention/hooks/useSprint";
import { SparklesIcon } from "lucide-react";

type SprintMode = "q5" | "q10" | "t3" | "t5";

const MODE_LABELS: Record<SprintMode, string> = {
  q5: "5 questões",
  q10: "10 questões",
  t3: "3 minutos",
  t5: "5 minutos",
};

/**
 * Sprint Mode screen: ultra-short study sessions (RF-04).
 * Presents mode selection, then drives through questions one by one.
 * Shows a summary card with XP and streak on completion.
 */
export function SprintScreen() {
  const { data, currentIndex, result, isLoading, isSubmitting, isDone, error, start, recordAnswer } = useSprint();

  if (error) {
    return <ErrorForScreens error={"Tentar novamente..."} load={() => void start("q5")} />;
  }

  if (isDone && result) {
    return (
      <AppLayout>
        <div className="mx-auto flex max-w-lg flex-col items-center gap-6 px-4 py-12">
          <h1 className="font-mono text-lg uppercase tracking-wide text-[var(--pixel-accent)]">Sprint Concluído!</h1>
          <PixelCard className="w-full flex flex-col gap-3 text-center">
            <p className="font-mono text-2xl text-[var(--pixel-text)]">{result.scorePercent}%</p>
            <p className="font-mono text-sm text-[var(--pixel-muted)]">+{result.gainedXp} XP</p>
            <p className="font-mono text-sm text-[var(--pixel-muted)]">
              Sequência: {result.streakDays} dia{result.streakDays !== 1 ? "s" : ""}
            </p>
          </PixelCard>
          {result.newAchievements.length > 0 && (
            <div className="flex flex-col gap-2 w-full">
              <p className="font-mono text-xs uppercase tracking-wide text-[var(--pixel-accent)]">
                Conquistas Desbloqueadas
              </p>
              {result.newAchievements.map((a) => (
                <PixelCard key={a.code} className="flex flex-col gap-1">
                  <p className="font-mono text-sm text-[var(--pixel-text)]">{a.name}</p>
                  <p className="font-mono text-xs text-[var(--pixel-muted)]">{a.description}</p>
                </PixelCard>
              ))}
            </div>
          )}
          <div className="flex gap-3 flex-wrap justify-center">
            {(Object.keys(MODE_LABELS) as SprintMode[]).map((mode) => (
              <PixelButton key={mode} variant="ghost" onClick={() => void start(mode)}>
                {MODE_LABELS[mode]}
              </PixelButton>
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  if (isLoading) {
    return <LoadingForScreens text="Carregando Sprint..." />;
  }

  if (!data) {
    // Mode selection screen.
    return (
      <AppLayout>
        <PixelCard className="mx-auto mt-4 max-w-lg px-2 py-3">
          <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-12">
            <div className="flex items-center gap-2">
              <SparklesIcon size={36} />
              <h1 className="font-mono text-sm uppercase tracking-wide text-pixel-text">Sprint Mode</h1>
            </div>
            <p className="font-mono text-xs text-pixel-subtext">
              Sessões ultra-rápidas para manter o ritmo. Escolha o modo:
            </p>
            <div className="flex flex-wrap gap-3">
              {(Object.keys(MODE_LABELS) as SprintMode[]).map((mode) => (
                <PixelButton key={mode} onClick={() => void start(mode)} className="min-w-[130px]">
                  {MODE_LABELS[mode]}
                </PixelButton>
              ))}
            </div>
          </div>
        </PixelCard>
      </AppLayout>
    );
  }

  const currentQuestion = data.questions[currentIndex];
  if (!currentQuestion) return null;

  return (
    <AppLayout>
      <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-6">
        <SprintRunner
          key={currentQuestion.id}
          question={currentQuestion}
          currentIndex={currentIndex}
          totalQuestions={data.questions.length}
          limitSeconds={data.limitSeconds}
          onAnswer={recordAnswer}
          isSubmitting={isSubmitting}
        />
      </div>
    </AppLayout>
  );
}
