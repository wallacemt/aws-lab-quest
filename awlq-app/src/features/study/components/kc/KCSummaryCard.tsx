"use client";

import { PixelButton } from "@/components/ui/pixel-button";
import { PixelCard } from "@/components/ui/pixel-card";

type KcSummary = {
  correct: number;
  total: number;
  scorePercent: number;
  gainedXp: number;
  historySaved: boolean;
};

type Props = {
  summary: KcSummary;
  onNewKC: () => void;
  onGoHome: () => void;
};

export function KCSummaryCard({ summary, onNewKC, onGoHome }: Props) {
  return (
    <PixelCard className="space-y-4 border-[var(--pixel-accent)] bg-[var(--pixel-accent)]/10">
      <p className="font-mono text-[10px] uppercase text-[var(--pixel-accent)]">KC Finalizado</p>
      <p className="font-[var(--font-body)] text-base">
        Pontuacao: {summary.scorePercent}% ({summary.correct}/{summary.total}) · +{summary.gainedXp} XP
      </p>
      <p className="font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
        {summary.historySaved
          ? "Resultado salvo no historico com sucesso."
          : "Resultado concluido, mas nao foi possivel salvar no historico."}
      </p>
      <div className="flex flex-wrap justify-end gap-2">
        <PixelButton onClick={onNewKC}>Fazer outro KC</PixelButton>
        <PixelButton variant="ghost" onClick={onGoHome}>
          Voltar ao inicio
        </PixelButton>
      </div>
    </PixelCard>
  );
}
