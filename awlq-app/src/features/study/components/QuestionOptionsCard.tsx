"use client";

import { ReactNode } from "react";
import { PixelCard } from "@/components/ui/pixel-card";
import { normalizeAnswerValue, normalizeCorrectOptions } from "@/features/study/services";
import { normalizeOptionText } from "@/lib/study-option-text";
import { QuestionOption, StudyAnswerValue, StudyQuestionType } from "@/lib/types";

export type QuestionCardQuestion = {
  id: string;
  statement: string;
  questionType: StudyQuestionType;
  options: Partial<Record<QuestionOption, string | null | undefined>>;
  correctOption: QuestionOption;
  correctOptions: QuestionOption[];
};

const OPTION_KEYS: QuestionOption[] = ["A", "B", "C", "D", "E"];

function toggleMultiAnswer(current: QuestionOption[], option: QuestionOption): QuestionOption[] {
  if (current.includes(option)) return current.filter((item) => item !== option).sort();
  return [...current, option].sort();
}

type Props = {
  question: QuestionCardQuestion;
  answer: StudyAnswerValue | undefined;
  onSelect: (value: StudyAnswerValue) => void;
  submitted: boolean;
  disabled?: boolean;
  large?: boolean;
  questionLabel?: string;
  headerActions?: ReactNode;
  footer?: ReactNode;
};

/** Shared question renderer used by Simulado and Sprint: statement, options, post-submit reveal. */
export function QuestionOptionsCard({
  question,
  answer,
  onSelect,
  submitted,
  disabled,
  large = false,
  questionLabel,
  headerActions,
  footer,
}: Props) {
  const selectedOptions = normalizeAnswerValue(answer);
  const correctOptions = normalizeCorrectOptions(question);

  function handleChange(option: QuestionOption) {
    if (submitted || disabled) return;
    const nextValue = question.questionType === "multi" ? toggleMultiAnswer(selectedOptions, option) : option;
    onSelect(nextValue);
  }

  return (
    <PixelCard className="space-y-4">
      {(questionLabel || headerActions) && (
        <div className="flex items-start justify-between gap-2">
          {questionLabel && (
            <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">{questionLabel}</p>
          )}
          {headerActions && <div className="flex items-center gap-2">{headerActions}</div>}
        </div>
      )}

      <p className={`font-[var(--font-body)] ${large ? "text-lg" : "text-base"}`}>{question.statement}</p>
      {question.questionType === "multi" && (
        <p className="font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">
          Questao multipla: selecione todas as alternativas corretas.
        </p>
      )}

      <div className="grid gap-4">
        {OPTION_KEYS.map((option) => {
          const text = normalizeOptionText(question.options[option]);
          if (!text) return null;
          const isCorrectOption = submitted && correctOptions.includes(option);
          const isSelectedWrong = submitted && selectedOptions.includes(option) && !isCorrectOption;
          return (
            <label
              key={`${question.id}-${option}`}
              className={`flex items-start gap-2 border-2 px-3 py-2 ${
                isCorrectOption
                  ? "border-[#2ecc71] bg-green-900/35"
                  : isSelectedWrong
                    ? "border-[#e74c3c] bg-red-900/35"
                    : "border-[var(--pixel-border)] bg-[var(--pixel-bg)]"
              }`}
            >
              <input
                type={question.questionType === "multi" ? "checkbox" : "radio"}
                name={question.id}
                checked={selectedOptions.includes(option)}
                onChange={() => handleChange(option)}
                disabled={submitted || disabled}
              />
              <span className={`font-[var(--font-body)] ${large ? "text-base" : "text-sm"}`}>
                {option}) {text}
              </span>
            </label>
          );
        })}
      </div>

      {footer}
    </PixelCard>
  );
}
