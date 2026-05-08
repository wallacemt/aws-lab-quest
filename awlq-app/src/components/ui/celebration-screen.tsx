"use client";

import { PixelButton } from "@/components/ui/pixel-button";

export function CelebrationScreen({
  open,
  xp,
  theme,
  onDoAnotherLab,
  onBackHome,
}: {
  open: boolean;
  xp: number;
  theme: string;
  onDoAnotherLab: () => void;
  onBackHome: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/85 p-4">
      <div className="w-full max-w-xl border-4 border-[var(--pixel-primary)] bg-[var(--pixel-card)] p-6 text-center shadow-[8px_8px_0_0_#000]">
        <p className="font-mono text-xs uppercase text-[var(--pixel-accent)]">Quest Completo</p>
        <h2 className="mt-2  text-4xl font-bold">AWS Hero</h2>
        <p className="mt-2 font-[var(--font-body)] text-lg">Tema: {theme}</p>
        <p className="mt-1 font-[var(--font-body)] text-lg">XP final: {xp}</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <PixelButton onClick={onDoAnotherLab}>Fazer outro LAB</PixelButton>
          <PixelButton variant="ghost" onClick={onBackHome}>
            Voltar ao inicio
          </PixelButton>
        </div>
      </div>
    </div>
  );
}
