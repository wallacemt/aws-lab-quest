"use client";

import { PixelButton } from "@/components/ui/pixel-button";
import { PixelCard } from "@/components/ui/pixel-card";
import { QuestionReviewPanel } from "@/features/study/components/QuestionReviewPanel";
import { ReportQuestionModal } from "@/features/study/components/ReportQuestionModal";
import { StudyAnswerMap, StudyExplanationResult } from "@/features/study";
import { normalizeAnswerValue, normalizeCorrectOptions } from "@/features/study/services";
import { ReportQuestionReason } from "@/features/study/services/study-api";
import { STUDY_OPTIONS } from "@/features/study/constants";
import { normalizeOptionText } from "@/lib/study-option-text";
import { QuestionOption, StudyQuestion } from "@/lib/types";

type ReviewOption = {
  option: QuestionOption;
  text: string;
  explanation: string;
  isCorrect: boolean;
  isSelected: boolean;
};

type Stats = {
  correct: number;
  wrong: number;
  answered: number;
  total: number;
};

type Props = {
  questions: StudyQuestion[];
  currentIndex: number;
  currentQuestion: StudyQuestion;
  answers: StudyAnswerMap;
  stats: Stats;
  submittedCurrent: boolean;
  submittingAnswer: boolean;
  loadingExplanation: boolean;
  isCurrentCorrect: boolean;
  currentExplanation: StudyExplanationResult | undefined;
  currentReviewOptions: ReviewOption[];
  flowError: string | null;
  reportMessage: string | null;
  reportModalOpen: boolean;
  reportSubmitting: boolean;
  onAnswerChange: (questionId: string, value: QuestionOption | QuestionOption[]) => void;
  onSubmitAnswer: () => void;
  onNextQuestion: () => void;
  onFinishKC: () => void;
  onReroll: () => void;
  onOpenReport: () => void;
  onCloseReport: () => void;
  onSubmitReport: (input: { reason: ReportQuestionReason; description: string }) => Promise<void>;
};

const OPTIONS = STUDY_OPTIONS;

function toggleMultiAnswer(current: QuestionOption[], option: QuestionOption): QuestionOption[] {
  if (current.includes(option)) return current.filter((item) => item !== option).sort();
  return [...current, option].sort();
}

export function KCQuestionFlow({
  questions,
  currentIndex,
  currentQuestion,
  answers,
  stats,
  submittedCurrent,
  submittingAnswer,
  loadingExplanation,
  isCurrentCorrect,
  currentExplanation,
  currentReviewOptions,
  flowError,
  reportMessage,
  reportModalOpen,
  reportSubmitting,
  onAnswerChange,
  onSubmitAnswer,
  onNextQuestion,
  onFinishKC,
  onReroll,
  onOpenReport,
  onCloseReport,
  onSubmitReport,
}: Props) {
  return (
    <>
      <PixelCard className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">
          Questao {currentIndex + 1}/{questions.length} · Acertos: {stats.correct} · Erros: {stats.wrong}
        </p>
        <PixelButton variant="ghost" onClick={onReroll}>
          Reiniciar
        </PixelButton>
      </PixelCard>

      <PixelCard className="space-y-4">
        <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">
          {currentQuestion.topic} · {currentQuestion.difficulty}
        </p>
        <p className="font-[var(--font-body)] text-base">{currentQuestion.statement}</p>
        {currentQuestion.questionType === "multi" && (
          <p className="font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">
            Questao multipla: selecione todas as alternativas corretas.
          </p>
        )}

        <div className="grid gap-4">
          {OPTIONS.map((option) => {
            const optionText = normalizeOptionText(currentQuestion.options[option]);
            if (!optionText) return null;
            const selectedOptions = normalizeAnswerValue(answers[currentQuestion.id]);
            const checked = selectedOptions.includes(option);
            const correctOptions = normalizeCorrectOptions(currentQuestion);
            const isCorrectOption = submittedCurrent && correctOptions.includes(option);
            const isSelectedWrong = submittedCurrent && checked && !isCorrectOption;
            return (
              <label
                key={`${currentQuestion.id}-${option}`}
                className={`flex items-start gap-4 border-2 px-3 py-2 ${
                  isCorrectOption
                    ? "border-[#2ecc71] bg-green-900/35"
                    : isSelectedWrong
                      ? "border-[#e74c3c] bg-red-900/35"
                      : "border-[var(--pixel-border)] bg-[var(--pixel-bg)]"
                }`}
              >
                <input
                  type={currentQuestion.questionType === "multi" ? "checkbox" : "radio"}
                  name={currentQuestion.id}
                  value={option}
                  checked={checked}
                  onChange={() => {
                    const current = normalizeAnswerValue(answers[currentQuestion.id]);
                    const nextValue =
                      currentQuestion.questionType === "multi" ? toggleMultiAnswer(current, option) : option;
                    onAnswerChange(currentQuestion.id, nextValue);
                  }}
                  disabled={submittedCurrent}
                />
                <span className="font-[var(--font-body)] text-sm">
                  {option}) {optionText}
                </span>
              </label>
            );
          })}
        </div>

        {submittingAnswer && (
          <PixelCard className="border-[var(--pixel-primary)] bg-[var(--pixel-primary)]/10">
            <p className="inline-flex items-center gap-2 font-[var(--font-body)] text-sm">
              <span className="h-3 w-3 animate-spin rounded-full border border-current border-r-transparent" />
              Gerando explição da Questão...
            </p>
          </PixelCard>
        )}

        {submittedCurrent && (
          <QuestionReviewPanel
            isCorrect={isCurrentCorrect}
            summary={currentExplanation?.summary ?? "Analise das alternativas para reforcar o aprendizado."}
            loading={loadingExplanation}
            loadingText="Gerando auditoria detalhada com IA..."
            options={currentReviewOptions}
          />
        )}

        {flowError && <p className="font-sans text-sm text-red-300">{flowError}</p>}
        {reportMessage && <p className="font-sans text-sm text-[var(--pixel-accent)]">{reportMessage}</p>}

        <div className="flex flex-wrap justify-end gap-2">
          <PixelButton variant="ghost" onClick={onOpenReport}>
            Denunciar questao
          </PixelButton>
          {!submittedCurrent ? (
            <PixelButton onClick={onSubmitAnswer} disabled={loadingExplanation || submittingAnswer}>
              {submittingAnswer ? "Gerando feedback..." : "Enviar resposta"}
            </PixelButton>
          ) : currentIndex < questions.length - 1 ? (
            <PixelButton onClick={onNextQuestion}>Proxima</PixelButton>
          ) : (
            <PixelButton onClick={onFinishKC}>Finalizar KC</PixelButton>
          )}
        </div>
      </PixelCard>

      <ReportQuestionModal
        open={reportModalOpen}
        questionStatement={currentQuestion.statement}
        submitting={reportSubmitting}
        onClose={onCloseReport}
        onSubmit={onSubmitReport}
      />
    </>
  );
}
