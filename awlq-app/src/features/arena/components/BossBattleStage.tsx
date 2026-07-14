"use client";

import { motion } from "framer-motion";
import { Flame } from "lucide-react";

type Question = {
  id: string;
  statement: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  optionE?: string | null;
};

export type BattleFeedback = { correct: boolean; damage: number; playerDamage: number } | null;

type Props = {
  bossName: string;
  bossArtworkUrl: string | null;
  maxHp: number;
  remainingHp: number;
  streak: number;
  playerName: string;
  playerAvatarUrl: string;
  playerMaxHp: number;
  playerHp: number;
  question: Question | null;
  selectedOption: number | null;
  onSelectOption: (index: number) => void;
  onSubmit: () => void;
  submitting: boolean;
  feedback: BattleFeedback;
  victory: boolean;
  defeated: boolean;
};

const OPTIONS = ["A", "B", "C", "D", "E"] as const;

function HpBar({ max, current }: { max: number; current: number }) {
  const pct = Math.max(0, Math.round((current / max) * 100));
  const color = pct > 50 ? "#22c55e" : pct > 25 ? "#f59e0b" : "#ef4444";
  return (
    <div className="space-y-1">
      <div className="flex justify-between font-mono text-xs text-[#94a3b8]">
        <span>HP</span>
        <span>
          {current} / {max}
        </span>
      </div>
      <div className="h-3 w-full rounded bg-[#1e293b]">
        <div
          className="h-full rounded transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export function BossBattleStage({
  bossName,
  bossArtworkUrl,
  maxHp,
  remainingHp,
  streak,
  playerName,
  playerAvatarUrl,
  playerMaxHp,
  playerHp,
  question,
  selectedOption,
  onSelectOption,
  onSubmit,
  submitting,
  feedback,
  victory,
  defeated,
}: Props) {
  const optionTexts: Record<string, string | undefined | null> = {
    A: question?.optionA,
    B: question?.optionB,
    C: question?.optionC,
    D: question?.optionD,
    E: question?.optionE,
  };
  const multiplier = 2 ** Math.floor(streak / 2);

  return (
    <div className="relative space-y-6">
      {/* Miss vignette — boss striking back */}
      <motion.div
        className="pointer-events-none fixed inset-0 z-40 bg-red-900"
        animate={{ opacity: feedback && !feedback.correct ? [0, 0.35, 0] : 0 }}
        transition={{ duration: 0.6 }}
      />

      <div className="space-y-6">
        {/* Battle field: boss on top (mirrors an enemy Pokémon), player on the bottom */}
        <div className="relative space-y-3">
          {/* Streak fire — only once the player is actually on a streak (more than 1x) */}
          {streak > 1 && (
            <motion.div
              className="absolute -top-3 right-4 z-30 flex items-center gap-1 border border-orange-500 bg-[#1a0f05] px-2 py-1"
              initial={{ opacity: 0, y: 0 }}
              animate={{ opacity: 1, y: [0, -6, 0] }}
              transition={{ y: { duration: 1.2, repeat: Infinity, ease: "easeInOut" } }}
            >
              <Flame className="h-4 w-4 text-orange-400" />
              <span className="font-mono text-xs font-bold text-orange-400">x{streak}</span>
            </motion.div>
          )}
          {/* Boss panel: info left, artwork right */}
          <motion.div
            className="flex  rounded-2xl items-center gap-4 border border-[#1e293b] bg-card/60 p-4"
            animate={
              feedback?.correct
                ? { x: [0, -14, 12, -8, 6, 0] }
                : feedback && !feedback.correct
                  ? { x: [0, 6, -6, 0] }
                  : { x: 0 }
            }
            transition={{ duration: 0.5 }}
          >
            <div className="flex-1 space-y-2">
              <p className="font-mono text-xs  font-bold uppercase text-[#f97316]">{bossName}</p>
              <HpBar max={maxHp} current={remainingHp} />
              {feedback?.correct && (
                <p className="animate-bounce font-mono text-xs font-bold text-red-400">
                  -{feedback.damage} HP{multiplier > 1 ? ` (x${multiplier})` : ""}
                </p>
              )}
              {feedback && !feedback.correct && (
                <p className="font-mono text-xs font-bold text-[#94a3b8]">Ataque desviado...</p>
              )}
            </div>
            {bossArtworkUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={bossArtworkUrl} alt={bossName} className="h-24 w-24 rounded object-cover" />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded border border-[#334155] bg-[#1e293b] font-mono text-2xl text-[#f97316]">
                B
              </div>
            )}
          </motion.div>
          {/* Player panel: mirrored — avatar left, info right */}
          <motion.div
            className="flex flex-row-reverse rounded-2xl items-center gap-4 border border-[#1e293b] bg-muted/80 p-4"
            animate={
              feedback && !feedback.correct
                ? { x: [0, -6, 6, 0] }
                : { x: 0 }
            }
            transition={{ duration: 0.5 }}
          >
            <div className="flex-1 space-y-2 text-right">
              <p className="font-mono text-xs font-bold uppercase text-accent">{playerName}</p>
              <HpBar max={playerMaxHp} current={playerHp} />
              {feedback && !feedback.correct && (
                <p className="animate-bounce font-mono text-xs font-bold text-red-400">
                  -{feedback.playerDamage} HP
                </p>
              )}
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={playerAvatarUrl} alt={playerName} className="h-24 w-24 rounded object-cover" />
          </motion.div>
        </div>
      </div>

      {victory && (
        <div className="border border-[#22c55e] bg-[#052e16] p-4 text-center">
          <p className="font-mono text-lg font-bold text-[#22c55e]">Vitória!</p>
          <p className="mt-1 font-mono text-xs text-[#86efac]">Você derrotou {bossName}!</p>
        </div>
      )}

      {defeated && (
        <div className="border border-[#334155] bg-[#1e1e1e] p-4 text-center">
          <p className="font-mono text-lg font-bold text-[#94a3b8]">Derrota...</p>
          <p className="mt-1 font-mono text-xs text-[#64748b]">
            Seus ataques chegaram a zero. Tente novamente!
          </p>
        </div>
      )}

      {!victory && !defeated && question && (
        <div className="space-y-4">
          {/* Enunciado */}
          <p className="border border-[#1e293b] bg-[#111827] p-4 font-[var(--font-body)] text-sm leading-6 text-[#e2e8f0]">
            {question.statement}
          </p>

          {/* Ações/Ataques */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {OPTIONS.map((letter, idx) => {
              const text = optionTexts[letter];
              if (!text) return null;

              const isSelected = selectedOption === idx;
              return (
                <button
                  key={letter}
                  type="button"
                  onClick={() => onSelectOption(idx)}
                  className={[
                    "w-full border px-4 py-3 text-left font-mono text-xs transition-colors",
                    isSelected
                      ? "border-[#f97316] bg-[#1f2937] text-[#f97316]"
                      : "border-[#1e293b] bg-[#0f172a] text-[#cbd5e1] hover:border-[#334155] hover:bg-[#1e293b]",
                  ].join(" ")}
                >
                  <span className="mr-3 font-bold">{letter}.</span>
                  {text}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onSubmit}
            disabled={selectedOption === null || submitting}
            className="w-full border border-[#f97316] bg-primary/50 px-4 py-3 font-mono text-xs font-bold uppercase text-shadow-pixel-text transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Atacando..." : "Atacar"}
          </button>
        </div>
      )}
    </div>
  );
}
