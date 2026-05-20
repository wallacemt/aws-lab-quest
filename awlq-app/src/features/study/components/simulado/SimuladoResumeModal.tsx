"use client";

import { PixelButton } from "@/components/ui/pixel-button";
import { PixelCard } from "@/components/ui/pixel-card";

type ResumeDraft = {
  currentIndex: number;
  questions: { id: string }[];
  answers: Record<string, unknown>;
  markedForReview: string[];
};

type Props = {
  open: boolean;
  draft: ResumeDraft | null;
  timerLabel: string;
  onResume: () => void;
  onDiscard: () => void;
};

export function SimuladoResumeModal({ open, draft, timerLabel, onResume, onDiscard }: Props) {
  if (!open || !draft) return null;

  const answeredCount = Object.values(draft.answers).filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4" role="dialog" aria-modal="true">
      <PixelCard className="w-full max-w-sm space-y-5 border-[var(--pixel-accent)]">
        <div>
          <p className="font-mono text-[10px] uppercase text-[var(--pixel-accent)]">Simulado em andamento</p>
          <h3 className="mt-2 font-[var(--font-body)] text-base">Deseja retomar de onde parou?</h3>
          <p className="mt-2 font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
            Questao {draft.currentIndex + 1} de {draft.questions.length} · {answeredCount} respondidas ·{" "}
            <span className="font-mono text-[var(--pixel-accent)]">{timerLabel}</span> restantes
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <PixelButton onClick={onResume} className="w-full justify-center">
            Retomar de onde parei
          </PixelButton>
          <PixelButton variant="ghost" onClick={onDiscard} className="w-full justify-center">
            Descartar e iniciar novo
          </PixelButton>
        </div>
      </PixelCard>
    </div>
  );
}
