"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import GameCard from "../../../components/ui/game-card";
import {
  STUDY_MODES,
  RETENTION_MODES,
  ADVENTURE_MODES,
  TOOLS_MODES,
  type GameMode,
} from "@/features/utils/home-apps";
import type { AppEntry, HomeConfig } from "@/app/api/admin/home-config/route";
import { fetchDailyQuiz } from "@/features/daily-quiz/services/daily-quiz-api";

const DAILY_QUIZ_MODE: GameMode = {
  id: "quiz-diario",
  title: "Quiz Diario",
  description: "5 questoes rapidas por dia para manter o streak e ganhar XP extra.",
  cta: "Responder Quiz",
};

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

function DailyQuizBanner({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-left w-full bg-pixel-card border-4 border-[#f97316] retro-shadow relative overflow-hidden focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-400/50 hover:border-orange-300 transition-colors animate-pulse-slow"
    >
      <div className="absolute -right-10 -top-10 w-40 h-40 bg-[#f97316]/20 rounded-full blur-3xl" />
      <div className="absolute left-24 bottom-0 w-24 h-24 bg-[#f97316]/10 rounded-full blur-2xl" />

      <div className="relative p-5 md:p-7 flex items-center gap-6">
        <div className="shrink-0 flex items-center justify-center w-16 h-16 md:w-20 md:h-20 border-2 border-[#f97316] bg-orange-900/30 text-4xl">
          🔥
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[10px] uppercase text-[#f97316] font-bold tracking-widest">
              Disponivel hoje
            </span>
          </div>
          <h3 className="font-mono text-xl md:text-2xl font-bold text-orange-300 uppercase tracking-wide mb-1">
            Quiz Diario
          </h3>
          <p className="text-pixel-subtext text-sm leading-relaxed">
            5 questoes rapidas. Responda antes da meia-noite para nao perder o XP de hoje.
          </p>
        </div>

        <div className="shrink-0 hidden md:flex flex-col items-end gap-1 font-mono text-[10px] uppercase text-orange-500 group-hover:text-orange-300 transition-colors">
          <span>Jogar agora</span>
          <span className="text-lg font-bold text-[#f97316]">Entrar ▶</span>
        </div>
      </div>
      <style>{`
        @keyframes pulse-slow-border { 0%, 100% { border-color: #f97316; } 50% { border-color: #fdba74; } }
        .animate-pulse-slow { animation: pulse-slow-border 2.4s ease-in-out infinite; }
      `}</style>
    </button>
  );
}

type VisibleCard = { mode: GameMode; highlighted: boolean };

// Returns modes that are enabled, sorted by admin-assigned order.
// Falls back to original order when no config is loaded yet.
function getVisible(modes: GameMode[], config: AppEntry[]): VisibleCard[] {
  if (config.length === 0) {
    return modes.map((m) => ({ mode: m, highlighted: false }));
  }
  const entryMap = new Map(config.map((e) => [e.id, e]));
  return modes
    .filter((m) => entryMap.get(m.id)?.enabled !== false)
    .sort((a, b) => (entryMap.get(a.id)?.order ?? 999) - (entryMap.get(b.id)?.order ?? 999))
    .map((m) => ({ mode: m, highlighted: entryMap.get(m.id)?.highlighted ?? false }));
}

type DailyQuizHomeState = "hidden" | "available" | "done";

export function HomeScreen() {
  const router = useRouter();
  const [showJornada, setShowJornada] = useState(false);
  const [config, setConfig] = useState<AppEntry[]>([]);
  const [dailyQuizState, setDailyQuizState] = useState<DailyQuizHomeState>("hidden");

  const fetchConfig = useCallback(() => {
    void fetch("/api/admin/home-config")
      .then((r) => r.json())
      .then((data: HomeConfig) => setConfig(data.apps))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    fetchConfig();
    const interval = window.setInterval(fetchConfig, 10_000);
    window.addEventListener("focus", fetchConfig);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", fetchConfig);
    };
  }, [fetchConfig]);

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

  // Only visible when the user has a certification badge (server-gated) — hidden
  // entirely until then. Highlighted banner until today's quiz is done, then a normal card.
  useEffect(() => {
    void fetchDailyQuiz()
      .then((data) => {
        if (data.locked) {
          setDailyQuizState("hidden");
          return;
        }
        setDailyQuizState(data.completed ? "done" : "available");
      })
      .catch(() => setDailyQuizState("hidden"));
  }, []);

  function handleClick(id: string) {
    if (id !== "simulado") {
      router.push(`/${id}`);
    }
  }

  const studyCards = getVisible(STUDY_MODES, config);
  const retentionCards = getVisible(RETENTION_MODES, config);
  const adventureCards = getVisible(ADVENTURE_MODES, config);
  const toolCards = getVisible(TOOLS_MODES, config);

  return (
    <AppLayout credits>
      <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8 xl:px-8">
        {/* Daily Quiz — highest-priority banner, shown only when unlocked and not yet done today */}
        {dailyQuizState === "available" && <DailyQuizBanner onClick={() => router.push("/quiz-diario")} />}

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
        {studyCards.length > 0 && (
          <section>
            <SectionDivider title="Modos de Estudo" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {studyCards.map(({ mode, highlighted }) => (
                <GameCard
                  key={mode.id}
                  {...mode}
                  highlighted={highlighted}
                  handleClick={() => handleClick(mode.id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Retention modes */}
        {(retentionCards.length > 0 || dailyQuizState === "done") && (
          <section>
            <SectionDivider title="Retencao de Conhecimento" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              {retentionCards.map(({ mode, highlighted }) => (
                <GameCard
                  key={mode.id}
                  {...mode}
                  highlighted={highlighted}
                  handleClick={() => handleClick(mode.id)}
                />
              ))}

              {dailyQuizState === "done" && (
                <GameCard {...DAILY_QUIZ_MODE} handleClick={() => router.push("/quiz-diario")} />
              )}
            </div>
          </section>
        )}

        {/* Adventure / challenge modes */}
        {(adventureCards.length > 0 || showJornada) && (
          <section>
            <SectionDivider title="Aventura e Desafios" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {adventureCards.map(({ mode, highlighted }) => (
                <GameCard
                  key={mode.id}
                  {...mode}
                  highlighted={highlighted}
                  handleClick={() => handleClick(mode.id)}
                />
              ))}

              {showJornada && <JornadaCard onClick={() => router.push("/jornada")} />}
            </div>
          </section>
        )}

        {/* Tools */}
        {toolCards.length > 0 && (
          <section className="mb-12">
            <SectionDivider title="Ferramentas" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {toolCards.map(({ mode, highlighted }) => (
                <GameCard
                  key={mode.id}
                  {...mode}
                  highlighted={highlighted}
                  handleClick={() => handleClick(mode.id)}
                />
              ))}
            </div>
          </section>
        )}
      </main>
    </AppLayout>
  );
}
