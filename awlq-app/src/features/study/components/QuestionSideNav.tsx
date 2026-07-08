"use client";

import { ReactNode } from "react";
import { PixelCard } from "@/components/ui/pixel-card";
import { QuestionCardQuestion } from "@/features/study/components/QuestionOptionsCard";
import { isAnswerCorrect, normalizeAnswerValue } from "@/features/study/services";
import { StudyAnswerValue } from "@/lib/types";

type Props = {
  questions: QuestionCardQuestion[];
  answers: Record<string, StudyAnswerValue | undefined>;
  currentIndex: number;
  submitted: boolean;
  markedForReview?: Set<string>;
  onGoToQuestion: (index: number) => void;
  title?: string;
  children?: ReactNode;
};

/** Shared question navigation grid used by Simulado and Sprint. */
export function QuestionSideNav({
  questions,
  answers,
  currentIndex,
  submitted,
  markedForReview,
  onGoToQuestion,
  title = "Navegacao",
  children,
}: Props) {
  const answeredCount = questions.filter((q) => normalizeAnswerValue(answers[q.id]).length > 0).length;

  return (
    <PixelCard className="space-y-3">
      <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">{title}</p>

      <div className="space-y-1">
        <div className="flex justify-between font-mono text-[10px] text-[var(--pixel-subtext)]">
          <span>
            Respondidas: {answeredCount}/{questions.length}
          </span>
          {markedForReview && markedForReview.size > 0 && (
            <span className="text-yellow-400">{markedForReview.size} p/ revisao</span>
          )}
        </div>
        {!submitted && (
          <div className="h-1 w-full overflow-hidden rounded bg-[var(--pixel-border)]">
            <div
              className="h-full bg-[var(--pixel-accent)] transition-all duration-300"
              style={{ width: `${questions.length > 0 ? (answeredCount / questions.length) * 100 : 0}%` }}
            />
          </div>
        )}
      </div>

      {!submitted && markedForReview && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[9px] text-[var(--pixel-subtext)]">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 border border-[var(--pixel-accent)] bg-[var(--pixel-accent)]/30" />
            Resp.
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 border border-yellow-400 bg-yellow-900/30" />
            Revisar
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 border border-[var(--pixel-border)] bg-[var(--pixel-bg)]" />
            Vazia
          </span>
        </div>
      )}

      <div className="grid grid-cols-5 gap-1.5">
        {questions.map((question, index) => {
          const answered = normalizeAnswerValue(answers[question.id]).length > 0;
          const isCurrent = index === currentIndex;
          const isMarked = !submitted && markedForReview?.has(question.id);
          const isCorrectAfterSubmit =
            submitted &&
            isAnswerCorrect({
              questionType: question.questionType,
              answer: answers[question.id],
              correctOption: question.correctOption,
              correctOptions: question.correctOptions,
            });
          return (
            <button
              key={question.id}
              type="button"
              onClick={() => onGoToQuestion(index)}
              className={`border px-1 py-1.5 font-mono text-[10px] uppercase transition-colors ${
                isCurrent
                  ? "border-[var(--pixel-primary)] bg-[var(--pixel-primary)]/20"
                  : submitted
                    ? isCorrectAfterSubmit
                      ? "border-[#2ecc71] bg-green-900/15"
                      : "border-[#e74c3c] bg-red-900/20"
                    : isMarked
                      ? "border-yellow-400 bg-yellow-900/20"
                      : answered
                        ? "border-[var(--pixel-accent)] bg-[var(--pixel-accent)]/15"
                        : "border-[var(--pixel-border)] bg-[var(--pixel-bg)]"
              }`}
            >
              {index + 1}
            </button>
          );
        })}
      </div>

      {children}
    </PixelCard>
  );
}
