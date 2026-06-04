"use client";

import { PixelCard } from "@/components/ui/pixel-card";
import { MemoryRecoveryItem } from "@/features/retention/services/retention-api";

type Props = {
  item: MemoryRecoveryItem;
};

/**
 * Displays a "Você acertou X há Y dias — ainda lembra?" prompt for a single question (RF-07).
 */
export function MemoryRecoveryCard({ item }: Props) {
  const { question, daysSince } = item;

  return (
    <PixelCard className="flex flex-col gap-2">
      <p className="font-mono text-xs uppercase tracking-wide text-[var(--pixel-accent)]">
        Memória Antiga — {daysSince} dias atrás
      </p>
      <p className="font-mono text-sm leading-relaxed text-[var(--pixel-text)] line-clamp-3">
        {question.statement}
      </p>
      {question.awsService && (
        <p className="font-mono text-xs text-[var(--pixel-muted)]">
          Serviço: {question.awsService.name}
        </p>
      )}
      <p className="font-mono text-xs text-[var(--pixel-muted)] opacity-70">
        Você acertou isso — ainda lembra?
      </p>
    </PixelCard>
  );
}
