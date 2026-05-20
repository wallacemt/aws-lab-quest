"use client";

import { PixelButton } from "@/components/ui/pixel-button";
import { PixelCard } from "@/components/ui/pixel-card";
import { StudyQuestion } from "@/lib/types";

type Props = {
  open: boolean;
  questions: StudyQuestion[];
  answeredCount: number;
  markedForReview: Set<string>;
  onGoToQuestion: (index: number) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export function SimuladoPreSubmitModal({
  open,
  questions,
  answeredCount,
  markedForReview,
  onGoToQuestion,
  onCancel,
  onConfirm,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4" role="dialog" aria-modal="true">
      <PixelCard className="w-full max-w-xl space-y-4">
        <p className="font-mono text-[10px] uppercase text-[var(--pixel-primary)]">Resumo antes de enviar</p>
        <h3 className="font-[var(--font-body)] text-lg">Revise antes de confirmar</h3>

        <div className="grid grid-cols-2 gap-3">
          <div className="border border-[var(--pixel-border)] bg-[var(--pixel-bg)] p-3 text-center">
            <p className="font-mono text-2xl text-[var(--pixel-primary)]">{answeredCount}</p>
            <p className="mt-1 font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Respondidas</p>
          </div>
          <div className="border border-[var(--pixel-border)] bg-[var(--pixel-bg)] p-3 text-center">
            <p className="font-mono text-2xl text-yellow-400">{markedForReview.size}</p>
            <p className="mt-1 font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Marcadas p/ revisao</p>
          </div>
        </div>

        {markedForReview.size > 0 && (
          <div className="space-y-2">
            <p className="font-mono text-[10px] uppercase text-yellow-400">Questoes marcadas para revisao</p>
            <div className="flex flex-wrap gap-2">
              {questions.map((q, i) =>
                markedForReview.has(q.id) ? (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => onGoToQuestion(i)}
                    className="border border-yellow-400 bg-yellow-900/20 px-2 py-1 font-mono text-[10px] text-yellow-300 hover:bg-yellow-900/40"
                  >
                    Q{i + 1}
                  </button>
                ) : null,
              )}
            </div>
          </div>
        )}

        {answeredCount < questions.length && (
          <p className="font-[var(--font-body)] text-xs text-yellow-300">
            Atencao: {questions.length - answeredCount} questao(oes) sem resposta serao contadas como erradas.
          </p>
        )}

        <div className="flex justify-end gap-2">
          <PixelButton variant="ghost" onClick={onCancel}>
            Voltar para revisar
          </PixelButton>
          <PixelButton onClick={onConfirm}>Confirmar Envio</PixelButton>
        </div>
      </PixelCard>
    </div>
  );
}
