"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/ui/AppLayout";
import { PixelCard } from "@/components/ui/PixelCard";
import BottomNav from "../../../components/ui/BottomNav";
import GameCard from "../../../components/ui/GameCard";

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
  return (
    <AppLayout credits>
      <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8 xl:px-8">
        {/* Welcome */}
        <section className="mb-8 md:mb-12 retro-border bg-pixel-card p-6 md:p-10 retro-shadow relative overflow-hidden">
          {/* Decorative background elements */}
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute right-20 bottom-10 w-20 h-20 bg-accent/10 rounded-full blur-2xl" />

          <div className="relative z-10">
            <div className="inline-block px-3 py-1 border-2 border-green-900 bg-green-800/20 retro-shadow text-accent font-mono font-bold text-xs md:text-sm rounded-full mb-4 uppercase tracking-wider ">
              Subindo de level ate a certificação AWS
            </div>
            <h2 className="font-mono text-3xl md:text-4xl font-bold text-pixel-text mb-4 uppercase tracking-tight">
              Selecione seu <span className="text-primary animate-pulse">Desafio</span>
            </h2>
            <p className="text-pixel-subtext text-base md:text-lg max-w-2xl">
              Escolha um modo abaixo para iniciar seu treinamento. Ganhe XP, conquiste badges e prepare-se para a
              certificação AWS.
            </p>
          </div>
        </section>

        {/* Game Modes Grid */}
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <h3 className="font-mono text-xl md:text-2xl font-bold text-pixel-text uppercase tracking-widest">
              Modos Disponiveis
            </h3>
            <div className="flex-1 h-1 bg-pixel-border/10 rounded-full" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {GAME_MODES.map((mode) => (
              <GameCard
                key={mode.id}
                {...mode}
                handleClick={() => {
                  router.push(`/${mode.id}`);
                }}
              />
            ))}
          </div>
        </section>
      </main>
    </AppLayout>
  );
}
