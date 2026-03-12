"use client";

import { useState } from "react";
import { PixelCard } from "@/components/ui/PixelCard";
import Link from "next/link";

type CreatorCreditsProps = {
  compact?: boolean;
};

export function CreatorCredits({ compact = false }: CreatorCreditsProps) {
  const [visible, setVisible] = useState(!compact);

  return (
    <section className="mx-auto max-w-[600px] px-4 pb-8 xl:px-8">
      <div className="mb-2 flex justify-end">
        <button
          type="button"
          onClick={() => setVisible((state) => !state)}
          className="border border-[var(--pixel-border)] bg-[var(--pixel-card)] px-2 py-1 font-[var(--font-pixel)] text-[8px] uppercase text-[var(--pixel-subtext)] opacity-80 transition-opacity hover:opacity-100"
          aria-expanded={visible}
          aria-controls="creator-credits-panel"
        >
          {visible ? "Ocultar Creditos" : "Mostrar Creditos"}
        </button>
      </div>

      {visible && (
        <PixelCard id="creator-credits-panel" className={compact ? "space-y-2 opacity-90" : "space-y-3"}>
          <h2 className="font-[var(--font-pixel)] text-[10px] uppercase text-[var(--pixel-primary)]">
            Creditos do Criador
          </h2>

          <p
            className={
              compact
                ? "font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]"
                : "font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]"
            }
          >
            Projeto criado por <span className="font-semibold text-[var(--pixel-text)]">Wallace Santana</span>.
          </p>

          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
            <Link
              href="https://github.com/wallacemt"
              target="_blank"
              rel="noopener noreferrer"
              className={
                compact
                  ? "border border-[var(--pixel-border)] bg-[var(--pixel-muted)] px-2 py-1 text-center font-[var(--font-body)] text-xs hover:brightness-110"
                  : "border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)] px-3 py-2 text-center font-[var(--font-body)] text-sm hover:brightness-110"
              }
            >
              GitHub
            </Link>
            <Link
              href="https://www.linkedin.com/in/wallace-santanak0/"
              target="_blank"
              rel="noopener noreferrer"
              className={
                compact
                  ? "border border-[var(--pixel-border)] bg-[var(--pixel-muted)] px-2 py-1 text-center font-[var(--font-body)] text-xs hover:brightness-110"
                  : "border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)] px-3 py-2 text-center font-[var(--font-body)] text-sm hover:brightness-110"
              }
            >
              LinkedIn
            </Link>
          </div>
        </PixelCard>
      )}
    </section>
  );
}
