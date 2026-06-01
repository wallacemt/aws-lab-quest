"use client";

import { FlaskConical, BookOpen, ClipboardList, RotateCcw, Sword, Trophy } from "lucide-react";

const FEATURES = [
  {
    icon: FlaskConical,
    title: "Lab Quest",
    description:
      "Missoes praticas por servico AWS. Cada desafio simula decisoes reais de arquitetura — voce nao responde questoes, voce resolve problemas.",
    highlight: false,
  },
  {
    icon: BookOpen,
    title: "Knowledge Check",
    description:
      "Sessoes rapidas por topico para revisar um conceito especifico antes do exame. 10 questoes, feedback imediato, sem rodeios.",
    highlight: false,
  },
  {
    icon: ClipboardList,
    title: "Simulado Completo",
    description:
      "Prova com cronometro, distribuicao por dificuldade e scoring detalhado. Exatamente como sera na certificacao real.",
    highlight: true,
  },
  {
    icon: RotateCcw,
    title: "Revisao com IA",
    description:
      "O sistema detecta onde voce erra, gera questoes novas direcionadas e garante que suas lacunas virem pontos fortes.",
    highlight: false,
  },
  {
    icon: Sword,
    title: "Jornada do Heroi",
    description:
      "Narrativa progressiva: cada stage e um servico AWS com missoes proprias. Voce avanca no mapa — e no dominio da nuvem.",
    highlight: false,
  },
  {
    icon: Trophy,
    title: "Leaderboard Live",
    description:
      "Ranking em tempo real. XP, conquistas e badges de nivel publicados ao vivo. Competicao saudavel que sustenta o habito.",
    highlight: false,
  },
];

export function FeaturesSection() {
  return (
    <section className="landing-section landing-section-img relative overflow-hidden border-t-4 border-b-4 border-primary">
      {/* Pixel art background */}
      <div
        className="landing-section-bg"
        style={{ backgroundImage: "url('/backgrounds/px-city-2.png')" }}
      />
      {/* Dark overlay */}
      <div className="landing-section-overlay" style={{ background: "rgba(8,12,24,0.82)" }} />

      <div className="relative z-10 mx-auto max-w-5xl space-y-14">
        <div className="text-center">
          <p
            className="mb-3 font-mono text-[10px] uppercase tracking-widest"
            style={{ color: "var(--pixel-primary,#f97316)" }}
          >
            {`// MODOS DE ESTUDO`}
          </p>
          <h2 className="font-mono text-2xl font-bold uppercase tracking-wide text-white md:text-3xl">
            6 formas de chegar la
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-white/60">
            Do warmup rapido ao simulado completo — cada modo foi desenhado para
            um momento especifico da sua preparacao.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="pixel-card-hover group relative space-y-3 border-2 p-5 transition-all duration-200"
                style={{
                  borderColor: feature.highlight
                    ? "rgba(249,115,22,0.5)"
                    : "var(--pixel-border,#1e293b)",
                  background: feature.highlight
                    ? "rgba(249,115,22,0.08)"
                    : "var(--section-card-bg, rgba(10,14,26,0.82))",
                  backdropFilter: "blur(12px)",
                  boxShadow: feature.highlight
                    ? "0 0 24px rgba(249,115,22,0.1)"
                    : "none",
                }}
              >
                <div className="pixel-corner pixel-corner-tl" />
                <div className="pixel-corner pixel-corner-tr" />
                <div className="pixel-corner pixel-corner-bl" />
                <div className="pixel-corner pixel-corner-br" />

                {feature.highlight && (
                  <div
                    className="absolute right-3 top-1 font-mono text-[8px] uppercase tracking-widest px-2 py-0.5 border"
                    style={{
                      borderColor: "var(--pixel-primary,#f97316)",
                      color: "var(--pixel-primary,#f97316)",
                    }}
                  >
                    Popular
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center border"
                    style={{
                      borderColor: "var(--pixel-primary,#f97316)",
                      color: "var(--pixel-primary,#f97316)",
                    }}
                  >
                    <Icon size={16} />
                  </div>
                  <h3 className="font-mono text-xs font-bold uppercase text-white">{feature.title}</h3>
                </div>
                <p className="text-xs leading-relaxed text-white/60">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
