"use client";

import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { EmptyForScreens } from "@/components/ui/empty-screens";
import { ErrorForScreens } from "@/components/ui/error-screens";
import { LoadingForScreens } from "@/components/ui/loading-screens";
import { PixelButton } from "@/components/ui/pixel-button";
import { PixelCard } from "@/components/ui/pixel-card";
import { QuestionCardQuestion, QuestionOptionsCard } from "@/features/study/components/QuestionOptionsCard";
import { QuestionSideNav } from "@/features/study/components/QuestionSideNav";
import { useWeeklyChallenge } from "@/features/arena/hooks/useWeeklyChallenge";
import { WeeklyChallengeQuestion } from "@/features/arena/services/arena-api";
import { WeeklyChallengeCard } from "@/features/arena/components/WeeklyChallengeCard";

/** Weekly challenge questions hide the answer key until submit, so correctOption is a placeholder — never revealed inline. */
function toCardQuestion(question: WeeklyChallengeQuestion): QuestionCardQuestion {
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

export function WeeklyChallengeScreen() {
  const router = useRouter();
  const { state, answers, currentIndex, isSubmitting, start, selectAnswer, goToQuestion, submit, reload } =
    useWeeklyChallenge();

  if (state.status === "loading" || state.status === "starting") {
    return <LoadingForScreens text="Carregando Desafio Semanal..." />;
  }

  if (state.status === "error") {
    return <ErrorForScreens error={state.message} load={() => void reload()} />;
  }

  if (state.status === "idle" && !state.data.challenge) {
    return <EmptyForScreens text="Nenhum desafio semanal ativo no momento." />;
  }

  if (state.status === "idle" || state.status === "submitted") {
    const { data } = state;
    return (
      <AppLayout>
        <div className="mx-auto max-w-2xl space-y-6 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="font-mono text-lg font-bold uppercase text-primary">Desafio Semanal</h1>
              <p className="mt-1 font-mono text-xs text-pixel-subtext">Compita com todos os usuários</p>
            </div>
            <PixelButton variant="ghost" onClick={() => router.back()}>
              ← Voltar
            </PixelButton>
          </div>

          {state.status === "submitted" && (
            <PixelCard className="border-[var(--pixel-accent)]">
              <p className="font-mono text-sm text-[var(--pixel-accent)]">
                Pontuação: {state.score} | +{state.gainedXp} XP
              </p>
              {state.newAchievements.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="font-mono text-xs uppercase tracking-wide text-[var(--pixel-accent)]">
                    Conquistas Desbloqueadas
                  </p>
                  {state.newAchievements.map((a) => (
                    <PixelCard key={a.code} className="flex flex-col gap-1">
                      <p className="font-mono text-sm text-pixel-text">{a.name}</p>
                      <p className="font-mono text-xs text-pixel-subtext">{a.description}</p>
                    </PixelCard>
                  ))}
                </div>
              )}
              <PixelButton
                variant="ghost"
                className="mt-3 w-full"
                onClick={() => router.push(`/history?tab=KC&reviewId=${state.historyId}`)}
              >
                Revisar respostas
              </PixelButton>
            </PixelCard>
          )}

          {data && <WeeklyChallengeCard data={data} />}

          {state.status === "idle" && !data.submitted && data.challenge && (
            <PixelButton className="w-full" onClick={() => void start()}>
              Iniciar Desafio
            </PixelButton>
          )}

          {state.status === "idle" && data.submitted && (
            <p className="text-center font-mono text-xs text-pixel-subtext">
              Você já respondeu o desafio desta semana. Volte na próxima segunda-feira!
            </p>
          )}
        </div>
      </AppLayout>
    );
  }

  // in-progress
  const cardQuestions = state.questions.map(toCardQuestion);
  const currentQuestion = cardQuestions[currentIndex];
  if (!currentQuestion) return null;

  const allAnswered = state.questions.every((q) => Boolean(answers[q.id]));

  return (
    <AppLayout>
      <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-4">
        <PixelButton variant="ghost" onClick={() => router.back()}>
          ← Voltar
        </PixelButton>
      </div>
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6">
        <PixelCard className="flex flex-wrap items-center justify-between gap-2 border-primary bg-primary/10">
          <p className="font-mono text-[10px] uppercase text-primary">
            Desafio Semanal · {state.questions.length} questões · 1 tentativa por semana
          </p>
        </PixelCard>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <QuestionOptionsCard
            question={currentQuestion}
            answer={answers[currentQuestion.id]}
            onSelect={(value) => selectAnswer(currentQuestion.id, Array.isArray(value) ? value[0] : value)}
            submitted={false}
            disabled={isSubmitting}
            questionLabel={`Questão ${currentIndex + 1} de ${state.questions.length}`}
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
                  {currentIndex + 1} / {state.questions.length}
                </span>
                <PixelButton
                  onClick={() => goToQuestion(currentIndex + 1)}
                  disabled={currentIndex === state.questions.length - 1}
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
            submitted={false}
            onGoToQuestion={goToQuestion}
            title="Navegação do desafio"
          >
            <PixelButton
              onClick={() => void submit()}
              disabled={!allAnswered || isSubmitting}
              className="w-full justify-center"
            >
              {isSubmitting ? "Enviando..." : "Enviar Respostas"}
            </PixelButton>
          </QuestionSideNav>
        </div>
      </div>
    </AppLayout>
  );
}
