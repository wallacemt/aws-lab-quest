"use client";

import { PixelCard } from "@/components/ui/pixel-card";
import { QuestionOption } from "@/lib/types";
import { cn } from "@/lib/utils";

export type QuestionReviewOption = {
  option: QuestionOption;
  text: string;
  explanation: string;
  isCorrect: boolean;
  isSelected: boolean;
};

type QuestionReviewPanelProps = {
  isCorrect: boolean;
  summary?: string;
  loading: boolean;
  loadingText?: string;
  options: QuestionReviewOption[];
  showExplanations?: boolean;
  questionStatement?: string;
  questionTypeLabel?: string;
  questionIndex?: number;
  questionCount?: number;
};

export function QuestionReviewPanel({
  isCorrect,
  summary,
  loading,
  loadingText = "Gerando revisao com IA...",
  options,
  showExplanations = true,
  questionStatement,
  questionTypeLabel,
  questionIndex,
  questionCount,
}: QuestionReviewPanelProps) {
  const questionLabel =
    typeof questionIndex === "number" && typeof questionCount === "number"
      ? `Questao ${questionIndex} de ${questionCount}`
      : undefined;

  return (
    <PixelCard
      className={cn(
        "space-y-3",
        isCorrect ? "border-[#2ecc71] bg-green-900/25" : "border-[#e74c3c] bg-red-900/25",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <p className={cn("font-mono text-[10px] uppercase", isCorrect ? "text-green-600/80" : "text-red-600/80")}>
            {isCorrect ? "✓ Resposta correta" : "✗ Resposta incorreta"}
          </p>
          {questionLabel && (
            <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">{questionLabel}</p>
          )}
        </div>

        {questionTypeLabel && (
          <span className="inline-flex items-center border border-[var(--pixel-border)] bg-[var(--pixel-muted)] px-2 py-1 font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">
            {questionTypeLabel}
          </span>
        )}
      </div>

      {questionStatement && (
        <div className="border border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-3">
          <p className="font-[var(--font-body)] text-base leading-relaxed">{questionStatement}</p>
        </div>
      )}

      {loading && (
        <p className="font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 animate-spin rounded-full border border-current border-r-transparent" />
            {loadingText}
          </span>
        </p>
      )}

      {summary && (
        <div className="border border-[var(--pixel-border)] bg-black/15 px-3 py-2">
          <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Resumo da revisao</p>
          <p className="mt-1 font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">{summary}</p>
        </div>
      )}

      <div className="space-y-2">
        {options.map((item) => (
          <div
            key={item.option}
            className={cn(
              "space-y-2 border px-3 py-2 ",
              item.isSelected && item.isCorrect
                ? "border-[#2ecc71] bg-green-900/30"
                : item.isSelected && !item.isCorrect
                  ? "border-[#e74c3c] bg-red-900/30"
                  : item.isCorrect
                    ? "border-[#2ecc71]/60 bg-green-900/15"
                    : "border-[var(--pixel-border)] bg-[var(--pixel-bg)]",
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-[var(--font-body)] text-sm leading-relaxed">
                <span className="mr-2 font-mono text-xs text-[var(--pixel-subtext)]">{item.option})</span>
                {item.text}
              </p>
              <div className="flex flex-wrap gap-1">
                <span
                  className={cn(
                    "border px-1.5 py-0.5 font-mono text-[10px] uppercase",
                    item.isCorrect
                      ? "border-[#2ecc71]/70 text-green-400"
                      : "border-[#e74c3c]/70 text-red-400",
                  )}
                >
                  {item.isCorrect ? "Correta" : "Incorreta"}
                </span>
                {item.isSelected && (
                  <span className="border border-[var(--pixel-primary)]/70 px-1.5 py-0.5 font-mono text-[10px] uppercase text-[var(--pixel-primary)]">
                    Sua resposta
                  </span>
                )}
              </div>
            </div>

            {showExplanations && item.explanation && (
              <p className="font-[var(--font-body)] text-gray-400 text-sm leading-relaxed">{item.explanation}</p>
            )}
            {!showExplanations && (
              <p className="font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">Explicacao oculta.</p>
            )}
          </div>
        ))}
        {options.length === 0 && (
          <p className="font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
            Nao ha alternativas para exibir nesta questao.
          </p>
        )}
      </div>
    </PixelCard>
  );
}
