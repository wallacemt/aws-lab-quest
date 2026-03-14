"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/AppLayout";
import { PixelCard } from "@/components/ui/PixelCard";

type GameMode = {
  id: "lab" | "kc" | "simulado" | "revisao";
  title: string;
  description: string;
  cta: string;
};

const GAME_MODES: GameMode[] = [
  {
    id: "lab",
    title: "Modo Lab",
    description: "Gerar um quest hands-on a partir de um lab real da AWS.",
    cta: "Jogar Lab",
  },
  {
    id: "kc",
    title: "Modo KC",
    description: "Knowledge Check com auditoria de respostas para fixar conceitos.",
    cta: "Abrir KC",
  },
  {
    id: "simulado",
    title: "Modo Simulado",
    description: "Simulacao de prova com 90 minutos e bloqueio de outras acoes.",
    cta: "Iniciar Simulado",
  },
  {
    id: "revisao",
    title: "Modo Revisao",
    description: "Revisao guiada por lacunas de conhecimento.",
    cta: "Abrir Revisao",
  },
];

export function HomeScreen() {
  const router = useRouter();
  const [selectedMode, setSelectedMode] = useState<GameMode["id"]>("lab");

  return (
    <AppLayout credits>
      <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 xl:px-8">
        {/* Welcome */}
        <PixelCard>
          <h1 className="font-[var(--font-pixel)] text-sm uppercase text-[var(--pixel-primary)]">
            AWS Certification Arcade
          </h1>
          <p className="mt-2 font-[var(--font-body)] text-lg">
            Escolha seu modo de jogo para se preparar para certificacoes AWS com trilhas retro e progressao.
          </p>
        </PixelCard>

        <section className="grid gap-4 md:grid-cols-2">
          {GAME_MODES.map((mode) => {
            const isSelected = selectedMode === mode.id;
            const isLab = mode.id === "lab";

            return (
              <PixelCard
                key={mode.id}
                className={`space-y-3 transition-all ${isSelected ? "border-[var(--pixel-primary)] bg-[var(--pixel-primary)]/10" : ""}`}
              >
                <div>
                  <h2 className="font-[var(--font-pixel)] text-xs uppercase text-[var(--pixel-primary)]">
                    {mode.title}
                  </h2>
                  <p className="mt-2 font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">{mode.description}</p>
                </div>
                {isLab ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMode("lab");
                      router.push("/lab");
                    }}
                    className="border-2 border-[var(--pixel-border)] bg-[var(--pixel-card)] px-3 py-2 font-[var(--font-pixel)] text-[10px] uppercase hover:bg-[var(--pixel-muted)]"
                  >
                    {mode.cta}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => router.push(`/${mode.id}`)}
                    className="border-2 border-[var(--pixel-border)] bg-[var(--pixel-card)] px-3 py-2 font-[var(--font-pixel)] text-[10px] uppercase hover:bg-[var(--pixel-muted)]"
                  >
                    {mode.cta}
                  </button>
                )}
              </PixelCard>
            );
          })}
        </section>
      </main>
    </AppLayout>
  );
}
