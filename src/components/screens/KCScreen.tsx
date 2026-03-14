"use client";

import { AppLayout } from "@/components/AppLayout";
import { PixelButton } from "@/components/ui/PixelButton";
import { PixelCard } from "@/components/ui/PixelCard";
import { useKCAudit } from "@/hooks/useKCAudit";
import { QuestionOption } from "@/lib/types";

const OPTIONS: QuestionOption[] = ["A", "B", "C", "D", "E"];

export function KCScreen() {
  const { questions, stats, answerQuestion, getQuestionResult, reset } = useKCAudit();

  return (
    <AppLayout>
      <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8 xl:px-8">
        <PixelCard>
          <h1 className="font-[var(--font-pixel)] text-sm uppercase text-[var(--pixel-primary)]">
            KC - Knowledge Check
          </h1>
          <p className="mt-2 font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
            Ao errar, voce recebe auditoria completa explicando por que cada alternativa esta correta ou incorreta.
          </p>
        </PixelCard>

        <PixelCard className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-[var(--font-pixel)] text-[10px] uppercase text-[var(--pixel-subtext)]">
            Respondidas: {stats.answered}/{stats.total} · Acertos: {stats.correct} · Erros: {stats.wrong}
          </p>
          <PixelButton variant="ghost" onClick={reset}>
            Reiniciar KC
          </PixelButton>
        </PixelCard>

        <div className="space-y-4">
          {questions.map((question, index) => {
            const result = getQuestionResult(question);
            return (
              <PixelCard key={question.id} className="space-y-3">
                <p className="font-[var(--font-pixel)] text-[10px] uppercase text-[var(--pixel-subtext)]">
                  Questao {index + 1} · {question.topic} · {question.difficulty}
                </p>
                <p className="font-[var(--font-body)] text-base">{question.statement}</p>

                <div className="grid gap-2">
                  {OPTIONS.map((option) => {
                    const value = question.options[option];
                    if (!value) return null;
                    return (
                      <label
                        key={`${question.id}-${option}`}
                        className="flex items-start gap-2 border border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2"
                      >
                        <input
                          type="radio"
                          name={question.id}
                          value={option}
                          onChange={() => answerQuestion(question.id, option)}
                        />
                        <span className="font-[var(--font-body)] text-sm">
                          {option}) {value}
                        </span>
                      </label>
                    );
                  })}
                </div>

                {result.selected && (
                  <PixelCard
                    className={
                      result.isCorrect
                        ? "border-[var(--pixel-accent)] bg-[var(--pixel-accent)]/10"
                        : "border-red-500 bg-red-900/15"
                    }
                  >
                    <p className="font-[var(--font-pixel)] text-[10px] uppercase">
                      {result.isCorrect ? "Resposta correta" : "Auditoria de erro"}
                    </p>
                    {!result.isCorrect && (
                      <div className="mt-2 space-y-2">
                        {OPTIONS.map((option) => {
                          const value = question.options[option];
                          if (!value) return null;
                          const isCorrectOption = option === question.correctOption;
                          const isSelected = option === result.selected;
                          return (
                            <div
                              key={`${question.id}-audit-${option}`}
                              className="border border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2"
                            >
                              <p className="font-[var(--font-pixel)] text-[9px] uppercase text-[var(--pixel-subtext)]">
                                {option}) {isCorrectOption ? "correta" : "incorreta"}
                                {isSelected ? " · sua resposta" : ""}
                              </p>
                              <p className="mt-1 font-[var(--font-body)] text-sm">
                                {question.explanations[option] ?? "Sem explicacao adicional."}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </PixelCard>
                )}
              </PixelCard>
            );
          })}
        </div>
      </main>
    </AppLayout>
  );
}
