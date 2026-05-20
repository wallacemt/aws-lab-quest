"use client";

import { motion } from "framer-motion";
import { PixelCard } from "@/components/ui/pixel-card";
import { SimuladoScoreGauge } from "@/features/study/components/SimuladoScoreGauge";

type TopicPerformance = {
  topic: string;
  attempts: number;
  correct: number;
  wrong: number;
  accuracyPercent: number;
};

export type ScoreOverviewData = {
  points: number;
  maxPoints: number;
  minimumCertificationPoints: number;
  bestArea: TopicPerformance | null;
  weakestArea: TopicPerformance | null;
};

type Props = {
  overview: ScoreOverviewData;
  calculating: boolean;
  submitted: boolean;
  loadingMotivationalMessage: boolean;
  motivationalMessage: string | null;
  onHideOverview?: () => void;
};

export function SimuladoResultOverview({
  overview,
  calculating,
  submitted,
  loadingMotivationalMessage,
  motivationalMessage,
  onHideOverview,
}: Props) {
  const passed = overview.points >= overview.minimumCertificationPoints;

  if (calculating && !submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <PixelCard className="space-y-6 py-10 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="relative flex h-16 w-16 items-center justify-center">
              <span className="absolute h-full w-full animate-ping rounded-full border-2 border-[var(--pixel-accent)] opacity-30" />
              <span className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--pixel-accent)] border-r-transparent" />
            </div>
            <div className="space-y-1">
              <p className="font-mono text-sm uppercase text-[var(--pixel-primary)]">Calculando resultado</p>
              <p className="font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">
                Processando suas respostas e calculando a pontuacao final...
              </p>
            </div>
          </div>
          <div className="mx-auto flex max-w-xs flex-col gap-2">
            {["Verificando respostas", "Calculando score", "Gerando overview de desempenho"].map((step, i) => (
              <motion.div
                key={step}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.18, duration: 0.25 }}
                className="flex items-center gap-2 text-left"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--pixel-accent)]" />
                <span className="font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">{step}</span>
              </motion.div>
            ))}
          </div>
        </PixelCard>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <PixelCard className="space-y-5 border-[var(--pixel-accent)] bg-[var(--pixel-card)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase text-[var(--pixel-accent)]">Score do Simulado</p>
            <h2 className="mt-1 font-sans text-2xl">Overview de Desempenho</h2>
          </div>
          {onHideOverview && (
            <button
              type="button"
              onClick={onHideOverview}
              className="border border-[var(--pixel-border)] px-3 py-2 text-[10px] uppercase"
            >
              Ocultar overview
            </button>
          )}
        </div>

        <SimuladoScoreGauge
          points={overview.points}
          maxPoints={overview.maxPoints}
          minimumCertificationPoints={overview.minimumCertificationPoints}
        />

        <div className="grid gap-3 md:grid-cols-2">
          <div className="border border-[#14532d] bg-green-900/20 p-3">
            <p className="font-mono text-[10px] uppercase text-green-300">Area com maior acerto</p>
            <p className="mt-1 font-[var(--font-body)] text-sm text-[var(--pixel-text)]">
              {overview.bestArea?.topic ?? "Sem dados"}
            </p>
            {overview.bestArea && (
              <p className="font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">
                {overview.bestArea.correct}/{overview.bestArea.attempts} corretas ({overview.bestArea.accuracyPercent}%)
              </p>
            )}
          </div>

          <div className="border border-[#7f1d1d] bg-red-900/20 p-3">
            <p className="font-mono text-[10px] uppercase text-red-300">Area com menor acerto</p>
            <p className="mt-1 font-[var(--font-body)] text-sm text-[var(--pixel-text)]">
              {overview.weakestArea?.topic ?? "Sem dados"}
            </p>
            {overview.weakestArea && (
              <p className="font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">
                {overview.weakestArea.correct}/{overview.weakestArea.attempts} corretas (
                {overview.weakestArea.accuracyPercent}%)
              </p>
            )}
          </div>
        </div>

        {(loadingMotivationalMessage || motivationalMessage) && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className={`rounded border px-4 py-3 ${
              passed ? "border-[#14532d] bg-green-900/15" : "border-[#1d4ed8] bg-blue-900/15"
            }`}
          >
            <p className={`font-mono text-[10px] uppercase ${passed ? "text-green-400" : "text-blue-400"}`}>
              Mensagem do AWSLQ
            </p>
            {loadingMotivationalMessage ? (
              <p className="mt-2 flex items-center gap-2 font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
                <span className="h-3 w-3 animate-spin rounded-full border border-current border-r-transparent" />
                Preparando mensagem personalizada...
              </p>
            ) : (
              <p className="mt-2 font-[var(--font-body)] text-sm leading-relaxed text-[var(--pixel-text)]">
                {motivationalMessage}
              </p>
            )}
          </motion.div>
        )}
      </PixelCard>
    </motion.div>
  );
}
