"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { ErrorForScreens } from "@/components/ui/error-screens";
import { LoadingForScreens } from "@/components/ui/loading-screens";
import { PixelButton } from "@/components/ui/pixel-button";
import { PixelCard } from "@/components/ui/pixel-card";
import { QuestionCardQuestion, QuestionOptionsCard } from "@/features/study/components/QuestionOptionsCard";
import { QuestionSideNav } from "@/features/study/components/QuestionSideNav";
import { useSprint } from "@/features/retention/hooks/useSprint";
import { SprintQuestion } from "@/features/retention/services/retention-api";
import { QuestionOption } from "@/lib/types";
import { triggerConfetti } from "@/features/utils/funcs/simulado-utils";
import { SparklesIcon } from "lucide-react";

type SprintMode = "s3" | "s5" | "s10";

const MODE_LABELS: Record<SprintMode, string> = {
  s3: "3 minutos (5q)",
  s5: "5 minutos (10q)",
  s10: "10 minutos (15q)",
};

/** Sprint questions are always single-select (DEF-021) — map to the shared card's generic shape. */
function toCardQuestion(question: SprintQuestion): QuestionCardQuestion {
  return {
    id: question.id,
    statement: question.statement,
    questionType: "single",
    options: {
      A: question.optionA,
      B: question.optionB,
      C: question.optionC,
      D: question.optionD,
      E: question.optionE ?? undefined,
    },
    correctOption: question.correctOption.toUpperCase() as QuestionOption,
    correctOptions: [question.correctOption.toUpperCase() as QuestionOption],
  };
}

/**
 * Sprint Mode screen: ultra-short study sessions (RF-04).
 * Presents mode selection, then a Simulado-style question + side-nav flow
 * (free navigation across preloaded questions, single submit at the end).
 */
export function SprintScreen() {
  const router = useRouter();
  const {
    data,
    answers,
    currentIndex,
    submitted,
    result,
    isLoading,
    isSubmitting,
    isDone,
    error,
    timeLeft,
    start,
    selectAnswer,
    goToQuestion,
    finish,
    cancel,
  } = useSprint();

  const confettiFiredRef = useRef(false);
  useEffect(() => {
    if (isDone && result && !confettiFiredRef.current) {
      confettiFiredRef.current = true;
      void triggerConfetti();
    }
    if (!isDone) confettiFiredRef.current = false;
  }, [isDone, result]);

  if (error) {
    return <ErrorForScreens error={"Tentar novamente..."} load={() => void start("s3")} />;
  }

  if (isDone && result) {
    return (
      <AppLayout>
        <div className="mx-auto flex max-w-lg flex-col items-center gap-6 px-4 py-12">
          <h1 className="font-mono text-lg uppercase tracking-wide text-[var(--pixel-accent)]">
            Parabéns! Sprint Concluído!
          </h1>
          <PixelCard className="w-full flex flex-col gap-3 text-center">
            <p className="font-mono text-2xl text-[var(--pixel-text)]">{result.scorePercent}%</p>
            <p className="font-mono text-sm text-primary">+{result.gainedXp} XP</p>
            <p className="font-mono text-sm text-pixel-subtext">
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
          <PixelButton onClick={() => router.push(`/history?tab=SPRINT&reviewId=${result.historyId}`)}>
            Revisar respostas
          </PixelButton>
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

  const cardQuestions = data.questions.map(toCardQuestion);
  const currentQuestion = cardQuestions[currentIndex];
  if (!currentQuestion) return null;

  const allAnswered = data.questions.every((q) => Boolean(answers[q.id]));

  return (
    <AppLayout>
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6">
        <PixelCard className="flex flex-wrap items-center justify-between gap-2 border-[var(--pixel-accent)] bg-[var(--pixel-accent)]/10">
          <p className="font-mono text-[10px] uppercase text-[var(--pixel-accent)]">
            Sprint · {MODE_LABELS[data.mode as SprintMode] ?? data.mode}
          </p>
          <div className="flex items-center gap-2">
            {timeLeft !== null && (
              <div
                className={`border-2 px-3 py-1 font-mono text-sm ${
                  timeLeft < 30 ? "border-red-400 text-red-300" : "border-[var(--pixel-border)] text-[var(--pixel-text)]"
                }`}
              >
                {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
              </div>
            )}
            <PixelButton
              variant="ghost"
              className="text-red-400"
              onClick={() => {
                if (window.confirm("Cancelar o sprint atual? Nenhuma resposta será salva.")) cancel();
              }}
            >
              Cancelar
            </PixelButton>
          </div>
        </PixelCard>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <QuestionOptionsCard
            question={currentQuestion}
            answer={answers[currentQuestion.id]}
            onSelect={(value) => selectAnswer(currentQuestion.id, Array.isArray(value) ? value[0] : value)}
            submitted={submitted}
            disabled={isSubmitting}
            questionLabel={`Questão ${currentIndex + 1} de ${data.questions.length}`}
            footer={
              <div className="flex items-center justify-between gap-2 border-t border-[var(--pixel-border)] pt-3">
                <PixelButton
                  variant="ghost"
                  onClick={() => goToQuestion(currentIndex - 1)}
                  disabled={currentIndex === 0}
                >
                  ← Anterior
                </PixelButton>
                <span className="font-mono text-[11px] text-[var(--pixel-subtext)]">
                  {currentIndex + 1} / {data.questions.length}
                </span>
                <PixelButton
                  onClick={() => goToQuestion(currentIndex + 1)}
                  disabled={currentIndex === data.questions.length - 1}
                >
                  Próxima →
                </PixelButton>
              </div>
            }
          />

          <QuestionSideNav
            questions={cardQuestions}
            answers={answers}
            currentIndex={currentIndex}
            submitted={submitted}
            onGoToQuestion={goToQuestion}
            title="Navegação do sprint"
          >
            <PixelButton
              onClick={() => void finish()}
              disabled={!allAnswered || isSubmitting}
              className="w-full justify-center"
            >
              Finalizar Sprint
            </PixelButton>
          </QuestionSideNav>
        </div>
      </div>
    </AppLayout>
  );
}
