"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { EmptyForScreens } from "@/components/ui/empty-screens";
import { ErrorForScreens } from "@/components/ui/error-screens";
import { LoadingForScreens } from "@/components/ui/loading-screens";
import { PixelButton } from "@/components/ui/pixel-button";
import { PixelCard } from "@/components/ui/pixel-card";
import { QuestionCardQuestion, QuestionOptionsCard } from "@/features/study/components/QuestionOptionsCard";
import { QuestionSideNav } from "@/features/study/components/QuestionSideNav";
import { useDailyQuiz } from "@/features/daily-quiz/hooks/useDailyQuiz";
import { DailyQuizQuestion } from "@/features/daily-quiz/services/daily-quiz-api";
import { triggerConfetti } from "@/features/utils/funcs/simulado-utils";

/** Daily quiz questions hide the answer key until submit, so correctOption is a placeholder — never revealed inline. */
function toCardQuestion(question: DailyQuizQuestion): QuestionCardQuestion {
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
    correctOption: "A",
    correctOptions: ["A"],
  };
}

/**
 * Quiz Diario screen: one short (5-question) session per day, gated on having
 * a certification badge. Reuses the Simulado-style question UI (RF convention)
 * instead of a bespoke layout.
 */
export function DailyQuizScreen() {
  const router = useRouter();
  const { state, answers, currentIndex, isSubmitting, selectAnswer, goToQuestion, submit, reload } = useDailyQuiz();

  const confettiFiredRef = useRef(false);
  useEffect(() => {
    if (state.status === "submitted" && !confettiFiredRef.current) {
      confettiFiredRef.current = true;
      void triggerConfetti();
    }
    if (state.status !== "submitted") confettiFiredRef.current = false;
  }, [state.status]);

  if (state.status === "loading") {
    return <LoadingForScreens text="Carregando Quiz Diario..." />;
  }

  if (state.status === "error") {
    return <ErrorForScreens error={state.message} load={() => void reload()} />;
  }

  if (state.status === "locked") {
    return <EmptyForScreens text={state.reason} />;
  }

  if (state.status === "no-quiz") {
    return <EmptyForScreens text="Quiz de hoje ainda nao foi gerado. Volte mais tarde." />;
  }

  if (state.status === "completed" || state.status === "submitted") {
    const { score, totalCount, gainedXp } = state;
    return (
      <AppLayout>
        <div className="mx-auto flex max-w-lg flex-col items-center gap-6 px-4 py-12">
          <h1 className="font-mono text-lg uppercase tracking-wide text-[#f97316]">Quiz Diario Concluido!</h1>
          <PixelCard className="w-full flex flex-col gap-3 text-center border-[#f97316]">
            <p className="font-mono text-2xl text-[var(--pixel-text)]">
              {score} / {totalCount}
            </p>
            <p className="font-mono text-sm text-primary">+{gainedXp} XP</p>
            {state.status === "completed" && (
              <p className="font-mono text-xs text-pixel-subtext">
                Completado em {new Date(state.completedAt).toLocaleString("pt-BR")}
              </p>
            )}
          </PixelCard>

          {state.status === "submitted" && state.newAchievements.length > 0 && (
            <div className="flex flex-col gap-2 w-full">
              <p className="font-mono text-xs uppercase tracking-wide text-[var(--pixel-accent)]">
                Conquistas Desbloqueadas
              </p>
              {state.newAchievements.map((a) => (
                <PixelCard key={a.code} className="flex flex-col gap-1">
                  <p className="font-mono text-sm text-[var(--pixel-text)]">{a.name}</p>
                  <p className="font-mono text-xs text-[var(--pixel-muted)]">{a.description}</p>
                </PixelCard>
              ))}
            </div>
          )}

          <PixelButton
            onClick={() =>
              router.push(
                state.status === "submitted"
                  ? `/history?tab=QUIZ_DIARIO&reviewId=${state.historyId}`
                  : "/history?tab=QUIZ_DIARIO",
              )
            }
          >
            Revisar respostas
          </PixelButton>
          <p className="font-mono text-xs text-pixel-subtext text-center">Volte amanha para um novo quiz!</p>
        </div>
      </AppLayout>
    );
  }

  // ready
  const cardQuestions = state.questions.map(toCardQuestion);
  const currentQuestion = cardQuestions[currentIndex];
  if (!currentQuestion) return null;

  const allAnswered = state.questions.every((q) => Boolean(answers[q.id]));

  return (
    <AppLayout>
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6">
        <PixelCard className="flex flex-wrap items-center justify-between gap-2 border-[#f97316] bg-[#f97316]/10">
          <p className="font-mono text-[10px] uppercase text-[#f97316]">
            Quiz Diario · {state.questions.length} questoes · 1 tentativa por dia
          </p>
        </PixelCard>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <QuestionOptionsCard
            question={currentQuestion}
            answer={answers[currentQuestion.id]}
            onSelect={(value) => selectAnswer(currentQuestion.id, Array.isArray(value) ? value[0] : value)}
            submitted={false}
            disabled={isSubmitting}
            questionLabel={`Questao ${currentIndex + 1} de ${state.questions.length}`}
            footer={
              <div className="flex items-center justify-between gap-2 border-t border-[var(--pixel-border)] pt-3">
                <PixelButton variant="ghost" onClick={() => goToQuestion(currentIndex - 1)} disabled={currentIndex === 0}>
                  ← Anterior
                </PixelButton>
                <span className="font-mono text-[11px] text-[var(--pixel-subtext)]">
                  {currentIndex + 1} / {state.questions.length}
                </span>
                <PixelButton onClick={() => goToQuestion(currentIndex + 1)} disabled={currentIndex === state.questions.length - 1}>
                  Proxima →
                </PixelButton>
              </div>
            }
          />

          <QuestionSideNav
            questions={cardQuestions}
            answers={answers}
            currentIndex={currentIndex}
            submitted={false}
            onGoToQuestion={goToQuestion}
            title="Navegacao do quiz"
          >
            <PixelButton onClick={() => void submit()} disabled={!allAnswered || isSubmitting} className="w-full justify-center">
              {isSubmitting ? "Enviando..." : "Enviar Respostas"}
            </PixelButton>
          </QuestionSideNav>
        </div>
      </div>
    </AppLayout>
  );
}
