"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Flame, Zap } from "lucide-react";

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

/**
 * Bursts once per streak increase, sized by the current streak — bigger
 * combo, bigger bolt. `key={streakBurstId}` forces a fresh mount (and
 * therefore a fresh `initial -> animate` play) on every increase instead of
 * only the first time `streak > 1` becomes true.
 */
function LightningBurst({ streakBurstId, streak }: { streakBurstId: number; streak: number }) {
  const size = Math.min(140, 32 + streak * 12);
  return (
    <motion.div
      key={streakBurstId}
      className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
      initial={{ opacity: 0, scale: 0.3, rotate: -8 }}
      animate={{ opacity: [0, 1, 1, 0], scale: [0.3, 1.25, 1, 1], rotate: [-8, 4, 0, 0] }}
      transition={{ duration: 0.7, times: [0, 0.25, 0.6, 1], ease: "easeOut" }}
    >
      <Zap
        style={{ width: size, height: size, filter: "drop-shadow(0 0 18px rgba(250,204,21,0.9))" }}
        className="fill-yellow-300 text-yellow-300"
      />
    </motion.div>
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

  // Fires a new lightning burst every time the streak goes up (not on reset/mount).
  const prevStreakRef = useRef(streak);
  const [streakBurstId, setStreakBurstId] = useState(0);
  useEffect(() => {
    if (streak > prevStreakRef.current && streak > 1) {
      setStreakBurstId((id) => id + 1);
    }
    prevStreakRef.current = streak;
  }, [streak]);

  return (
    <div className="relative space-y-6">
      {/* Miss vignette — boss striking back */}
      <motion.div
        className="pointer-events-none fixed inset-0 z-40 bg-red-900"
        animate={{ opacity: feedback && !feedback.correct ? [0, 0.35, 0] : 0 }}
        transition={{ duration: 0.6 }}
      />
      {/* Streak-up flash — synced with the lightning burst */}
      <motion.div
        key={streakBurstId}
        className="pointer-events-none fixed inset-0 z-40 bg-yellow-300"
        initial={{ opacity: 0 }}
        animate={{ opacity: streakBurstId > 0 ? [0, 0.18, 0] : 0 }}
        transition={{ duration: 0.5 }}
      />

      <div className="space-y-6">
        {/* Battle field: boss on top (mirrors an enemy Pokémon), player on the bottom */}
        <div className="relative space-y-3">
          {/* Streak counter — persistent badge showing the current multiplier */}
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

          {/* Boss panel: name/HP header on top, big hero artwork below */}
          <motion.div
            className="relative overflow-hidden rounded-2xl border border-[#1e293b] bg-card/60"
            animate={
              feedback?.correct
                ? { x: [0, -14, 12, -8, 6, 0] }
                : feedback && !feedback.correct
                  ? { x: [0, 6, -6, 0] }
                  : { x: 0 }
            }
            transition={{ duration: 0.5 }}
          >
            {/* Ambient glow — keeps the panel feeling alive even at idle */}
            <motion.div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(249,115,22,0.35),transparent_65%)]"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            />

            <div className="relative z-10 space-y-2 p-4 pb-0">
              <p className="font-mono text-xs font-bold uppercase text-[#f97316]">{bossName}</p>
              <HpBar max={maxHp} current={remainingHp} />
            </div>

            {/* Hero artwork — the boss is the star of this screen */}
            <div className="relative z-10 flex justify-center px-4 pb-2 pt-3">
              <motion.div
                className="relative"
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
              >
                <motion.div
                  animate={
                    feedback?.correct
                      ? { scale: [1, 1.12, 0.97, 1], filter: ["brightness(1)", "brightness(2.2)", "brightness(1)"] }
                      : { scale: 1, filter: "brightness(1)" }
                  }
                  transition={{ duration: 0.45 }}
                >
                  {bossArtworkUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={bossArtworkUrl}
                      alt={bossName}
                      className="h-44 w-44 rounded-xl object-cover shadow-[0_0_40px_rgba(249,115,22,0.35)] sm:h-56 sm:w-56"
                    />
                  ) : (
                    <div className="flex h-44 w-44 items-center justify-center rounded-xl border border-[#334155] bg-[#1e293b] font-mono text-4xl text-[#f97316] sm:h-56 sm:w-56">
                      B
                    </div>
                  )}
                </motion.div>
                {streakBurstId > 0 && <LightningBurst streakBurstId={streakBurstId} streak={streak} />}
              </motion.div>
            </div>

            <div className="relative z-10 min-h-[28px] px-4 pb-4 text-center">
              {feedback?.correct && (
                <p className="animate-bounce font-mono text-xs font-bold text-red-400">
                  -{feedback.damage} HP{multiplier > 1 ? ` (x${multiplier})` : ""}
                </p>
              )}
              {feedback && !feedback.correct && (
                <p className="font-mono text-xs font-bold text-[#94a3b8]">Ataque desviado...</p>
              )}
            </div>
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
