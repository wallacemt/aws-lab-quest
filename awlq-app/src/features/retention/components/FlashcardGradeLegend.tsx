"use client";

import { Frown, Meh, Smile, Laugh } from "lucide-react";
import { PixelCard } from "@/components/ui/pixel-card";

const LEGEND_ITEMS = [
  {
    icon: Frown,
    label: "Muito Difícil",
    color: "text-red-500",
    description: "Não lembrou — indica um gap de conhecimento. Reinicia o progresso, revisão de novo amanhã.",
  },
  {
    icon: Meh,
    label: "Difícil",
    color: "text-amber-500",
    description: "Lembrou com esforço — avança devagar, sem reiniciar o progresso já feito.",
  },
  {
    icon: Smile,
    label: "Bom",
    color: "text-[var(--pixel-accent)]",
    description: "Lembrou com alguma hesitação — ritmo padrão: 1 dia, depois 6, depois cada vez mais espaçado.",
  },
  {
    icon: Laugh,
    label: "Fácil",
    color: "text-blue-500",
    description: "Lembrou na hora — ritmo mais rápido; na primeira vez já pula para 4 dias.",
  },
];

/** Static legend explaining what each grade button means and how it affects the next review date. */
export function FlashcardGradeLegend() {
  return (
    <PixelCard className="flex flex-col gap-3">
      <p className="font-mono text-xs uppercase tracking-wide text-[var(--pixel-subtext)]">
        O que cada avaliação significa
      </p>
      <div className="flex flex-col gap-2">
        {LEGEND_ITEMS.map(({ icon: Icon, label, color, description }) => (
          <div key={label} className="flex items-start gap-2">
            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${color}`} />
            <p className="font-mono text-[11px] leading-relaxed text-[var(--pixel-text)]">
              <span className="uppercase">{label}:</span> {description}
            </p>
          </div>
        ))}
      </div>
    </PixelCard>
  );
}
