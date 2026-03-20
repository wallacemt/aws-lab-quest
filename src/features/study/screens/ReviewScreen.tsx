"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { PixelCard } from "@/components/ui/pixel-card";

export function ReviewScreen() {
  return (
    <AppLayout>
      <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 xl:px-8">
        <PixelCard>
          <h1 className="font-[var(--font-pixel)] text-sm uppercase text-[var(--pixel-primary)]">Modo Revisao</h1>
          <p className="mt-2 font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
            Esta tela sera usada para revisao guiada por gaps de conteudo. Nesta etapa inicial, o modo ja esta
            disponivel no menu de jogo e pronto para evolucao.
          </p>
        </PixelCard>
      </main>
    </AppLayout>
  );
}
