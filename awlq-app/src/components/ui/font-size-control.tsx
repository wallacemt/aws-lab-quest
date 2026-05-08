"use client";

import { useAccessibility } from "@/hooks/useAccessibility";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

export function FontSizeControl() {
  const { fontScale, hydrated, canIncrease, canDecrease, increaseFontSize, decreaseFontSize, resetFontSize } =
    useAccessibility();

  if (!hydrated) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger>
        <div className="flex w-full flex-wrap items-center gap-1 border-2 border-[var(--pixel-border)] bg-[var(--pixel-card)] px-2 py-1 md:w-auto">
          <button
            type="button"
            onClick={decreaseFontSize}
            disabled={!canDecrease}
            aria-label="Diminuir fonte"
            title="Diminuir fonte"
            className="border border-[var(--pixel-border)] px-1 font-mono text-[8px] disabled:opacity-40"
          >
            A-
          </button>
          <button
            type="button"
            onClick={increaseFontSize}
            disabled={!canIncrease}
            aria-label="Aumentar fonte"
            title="Aumentar fonte"
            className="border border-[var(--pixel-border)] px-1 font-mono text-[8px] disabled:opacity-40"
          >
            A+
          </button>
          <button
            type="button"
            onClick={resetFontSize}
            aria-label="Resetar fonte"
            title="Resetar fonte"
            className="border border-[var(--pixel-border)] px-1 font-mono text-[8px]"
          >
            100%
          </button>
          <span className="ml-auto font-[var(--font-body)]  text-[8px] text-[var(--pixel-subtext)] md:ml-0">
            {Math.round(fontScale * 100)}%
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent>Alterar Fonte</TooltipContent>
    </Tooltip>
  );
}
