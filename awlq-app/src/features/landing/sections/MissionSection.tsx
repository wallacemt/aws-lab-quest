"use client";

import { Zap, Target, BarChart3 } from "lucide-react";

const VALUES = [
  {
    icon: Target,
    title: "Aprenda Fazendo, Nao Decorando",
    description:
      "Cada sessao e um cenario real de exame AWS. Voce pratica decisoes, nao memoriza respostas. Nosso sistema adapta os desafios ao seu nivel — sempre na zona certa de aprendizagem.",
    tag: "Pratica ativa",
  },
  {
    icon: Zap,
    title: "Motivacao que Nao Acaba",
    description:
      "XP, niveis, badges e um leaderboard ao vivo mudam o estado mental do estudo. Em vez de dread, voce tem dopamina. Em vez de procrastinar, voce abre mais uma rodada.",
    tag: "Gamificacao",
  },
  {
    icon: BarChart3,
    title: "IA que Sabe Onde Voce Erra",
    description:
      "Nosso sistema detecta automaticamente suas areas fracas, gera questoes direcionadas com IA e acompanha sua curva de acertos. Voce ve progressao real — nao sente que esta estudando no escuro.",
    tag: "IA adaptativa",
  },
];

export function MissionSection() {
  return (
    <section className="landing-section landing-section-img relative overflow-hidden  border-secondary-foreground">
      {/* Pixel art background */}
      <div
        className="landing-section-bg"
        style={{ backgroundImage: "url('/backgrounds/px-city-1.png')" }}
      />
      {/* Dark overlay for readability */}
      <div className="landing-section-overlay" />

      <div className="relative z-10 mx-auto max-w-5xl space-y-14">
        <div className="text-center">
          <p
            className="mb-3 font-mono text-[10px] uppercase tracking-widest"
            style={{ color: "var(--pixel-primary,#f97316)" }}
          >
            {`// MISSAO`}
          </p>
          <h2 className="font-mono text-2xl font-bold uppercase tracking-wide text-white md:text-3xl">
            Por que estudar aqui funciona?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-white/60">
            A maioria das plataformas te da um dump de questoes. Nos construimos
            um sistema que entende como voce aprende — e te empurra para frente.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          {VALUES.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="pixel-card-hover group relative space-y-4 border-2 p-6 transition-all duration-200"
                style={{
                  borderColor: "var(--pixel-border,#1e293b)",
                  background: "var(--section-card-bg, rgba(10,14,26,0.82))",
                  backdropFilter: "blur(12px)",
                }}
              >
                <div className="pixel-corner pixel-corner-tl" />
                <div className="pixel-corner pixel-corner-tr" />
                <div className="pixel-corner pixel-corner-bl" />
                <div className="pixel-corner pixel-corner-br" />

                <div className="flex items-start justify-between">
                  <div
                    className="flex h-10 w-10 items-center justify-center border-2"
                    style={{
                      borderColor: "var(--pixel-primary,#f97316)",
                      color: "var(--pixel-primary,#f97316)",
                    }}
                  >
                    <Icon size={18} />
                  </div>
                  <span
                    className="font-mono text-[9px] uppercase tracking-widest opacity-70"
                    style={{ color: "var(--pixel-primary,#f97316)" }}
                  >
                    {item.tag}
                  </span>
                </div>
                <h3 className="font-mono text-sm font-bold uppercase leading-snug text-white">
                  {item.title}
                </h3>
                <p className="text-xs leading-relaxed text-white/60">{item.description}</p>
              </div>
            );
          })}
        </div>

        {/* Social proof bar */}
        <div
          className="flex flex-wrap items-center justify-center gap-8 border border-white/10 py-6 px-8"
          style={{ background: "var(--section-card-bg, rgba(10,14,26,0.7))", backdropFilter: "blur(8px)" }}
        >
          {[
            { value: "Gratuito", label: "Para comecar" },
            { value: "AWS", label: "Foco exclusivo" },
            { value: "IA", label: "Gerando questoes" },
          ].map((item) => (
            <div key={item.label} className="flex flex-col items-center gap-1">
              <span
                className="font-mono text-lg font-bold animate-pulse"
                style={{ color: "var(--pixel-primary,#f97316)" }}
              >
                {item.value}
              </span>
              <span className="font-mono text-[9px] uppercase text-white/45">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
