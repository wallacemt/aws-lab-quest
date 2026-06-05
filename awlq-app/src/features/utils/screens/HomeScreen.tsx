"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import GameCard from "../../../components/ui/game-card";

type GameMode = {
  id: string;
  title: string;
  description: string;
  cta: string;
};

const STUDY_MODES: GameMode[] = [
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

const RETENTION_MODES: GameMode[] = [
  {
    id: "flashcards",
    title: "Flashcards",
    description: "Revisao espacada com SM-2. Mantenha o conhecimento ativo no longo prazo.",
    cta: "Revisar Cards",
  },
  {
    id: "sprint",
    title: "Sprint Mode",
    description: "Sessoes ultra-rapidas de 3 a 10 questoes para manter o ritmo diario.",
    cta: "Iniciar Sprint",
  },
  {
    id: "daily-review",
    title: "Revisao Diaria",
    description: "Painel de itens pendentes para hoje com base no seu historico de erros.",
    cta: "Ver Revisao",
  },
];

const ADVENTURE_MODES: GameMode[] = [
  {
    id: "arena",
    title: "Arena de Batalha",
    description: "Enfrente bosses respondendo questoes e reduza o HP do inimigo.",
    cta: "Entrar na Arena",
  },
  {
    id: "trilhas",
    title: "Trilhas",
    description: "Percursos de aprendizagem por servico AWS com estagio a estagio.",
    cta: "Ver Trilhas",
  },
];

const TOOLS_MODES: GameMode[] = [
  {
    id: "biblioteca",
    title: "Biblioteca",
    description: "Acesse materiais de estudo, PDFs e artigos selecionados pelos instrutores.",
    cta: "Abrir Biblioteca",
  },
  {
    id: "mentor",
    title: "Mentor IA",
    description: "Receba orientacao personalizada do Mestre Yoda baseada nas suas lacunas de conhecimento.",
    cta: "Consultar Mentor",
  },
];

function SectionDivider({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <h3 className="font-mono text-xl md:text-2xl font-bold text-pixel-text uppercase tracking-widest whitespace-nowrap">
        {title}
      </h3>
      <div className="flex-1 h-1 bg-pixel-border/10 rounded-full" />
    </div>
  );
}

function JornadaCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-left w-full col-span-full bg-pixel-card border-4 border-yellow-600 retro-shadow relative overflow-hidden focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-400/50 hover:border-yellow-400 transition-colors"
    >
      <div className="absolute -right-8 -top-8 w-32 h-32 bg-yellow-500/10 rounded-full blur-2xl" />
      <div className="absolute left-20 bottom-0 w-20 h-20 bg-yellow-400/5 rounded-full blur-xl" />

      <div className="relative p-5 md:p-6 flex items-center gap-6">
        <div className="shrink-0 flex items-center justify-center w-16 h-16 border-2 border-yellow-500 bg-yellow-900/30">
          <span className="text-3xl">⚔</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[10px] uppercase text-yellow-400 font-bold tracking-widest">
              ⚡ Modo Especial
            </span>
          </div>
          <h3 className="font-mono text-xl md:text-2xl font-bold text-yellow-300 uppercase tracking-wide mb-1">
            Jornada do Heroi
          </h3>
          <p className="text-pixel-subtext text-sm leading-relaxed">
            Enfrente packs de simulado em ordem crescente de dificuldade. Derrote o BOSS e conquiste a certificacao.
          </p>
        </div>

        <div className="shrink-0 hidden md:flex flex-col items-end gap-1 font-mono text-[10px] uppercase text-yellow-600 group-hover:text-yellow-400 transition-colors">
          <span>Entrar na</span>
          <span className="text-lg font-bold text-yellow-400">Jornada ▶</span>
        </div>
      </div>
    </button>
  );
}

export function HomeScreen() {
  const router = useRouter();
  const [showJornada, setShowJornada] = useState(false);

  useEffect(() => {
    void fetch("/api/study/jornada?count=true", { credentials: "include" })
      .then((r) => r.json())
      .then((data: { totalCount?: number }) => {
        if (typeof data.totalCount === "number" && data.totalCount >= 5) {
          setShowJornada(true);
        }
      })
      .catch(() => undefined);
  }, []);

  function handleClick(id: string) {
    if (id !== "simulado") {
      router.push(`/${id}`);
    }
  }

  return (
    <AppLayout credits>
      <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8 xl:px-8">
        {/* Welcome */}
        <section className="mb-8 md:mb-12 retro-border bg-pixel-card p-6 md:p-10 retro-shadow relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute right-20 bottom-10 w-20 h-20 bg-accent/10 rounded-full blur-2xl" />

          <div className="relative z-10">
            <div className="inline-block px-3 py-1 border-2 border-green-900 bg-green-800/20 retro-shadow text-accent font-mono font-bold text-xs md:text-sm rounded-full mb-4 uppercase tracking-wider">
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

        {/* Core study modes */}
        <section>
          <SectionDivider title="Modos de Estudo" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {STUDY_MODES.map((mode) => (
              <GameCard
                key={mode.id}
                {...mode}
                handleClick={() => handleClick(mode.id)}
              />
            ))}
          </div>
        </section>

        {/* Retention modes */}
        <section>
          <SectionDivider title="Retencao de Conhecimento" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            {RETENTION_MODES.map((mode) => (
              <GameCard
                key={mode.id}
                {...mode}
                handleClick={() => handleClick(mode.id)}
              />
            ))}
          </div>
        </section>

        {/* Adventure / challenge modes */}
        <section>
          <SectionDivider title="Aventura e Desafios" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {ADVENTURE_MODES.map((mode) => (
              <GameCard
                key={mode.id}
                {...mode}
                handleClick={() => handleClick(mode.id)}
              />
            ))}

            {showJornada && <JornadaCard onClick={() => router.push("/jornada")} />}
          </div>
        </section>

        {/* Tools */}
        <section className="mb-12">
          <SectionDivider title="Ferramentas" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {TOOLS_MODES.map((mode) => (
              <GameCard
                key={mode.id}
                {...mode}
                handleClick={() => handleClick(mode.id)}
              />
            ))}
          </div>
        </section>
      </main>
    </AppLayout>
  );
}
