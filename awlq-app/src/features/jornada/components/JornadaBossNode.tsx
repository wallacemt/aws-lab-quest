"use client";

import Image from "next/image";

type JourneyNarrative = {
  stageName: string;
  storyText: string;
  awsContext: string;
};

type Stage = {
  packId: string;
  packName: string;
  difficultyScore: number;
  artworkUrl: string | null;
  questionCount: number;
  stageNumber: number;
  isBoss: boolean;
  completed: boolean;
  narrative: JourneyNarrative;
};

type Props = {
  stage: Stage;
  isCurrent: boolean;
  isFogged: boolean;
  onSelect: (stage: Stage) => void;
};

export function JornadaBossNode({ stage, isCurrent, isFogged, onSelect }: Props) {
  const { completed, narrative, artworkUrl, stageNumber } = stage;

  return (
    <button
      type="button"
      onClick={() => !isFogged && onSelect(stage)}
      disabled={isFogged}
      className={[
        "w-full text-left border-4 p-4 transition-all relative overflow-hidden",
        completed
          ? "border-green-400 bg-green-900/20"
          : isCurrent
            ? "border-yellow-400 bg-yellow-900/10 animate-pulse"
            : isFogged
              ? "border-[var(--pixel-border)] opacity-40 cursor-not-allowed"
              : "border-yellow-600 bg-yellow-900/10 hover:border-yellow-400",
      ].join(" ")}
    >
      {/* Pulsing background glow for active boss */}
      {isCurrent && !completed && (
        <div className="absolute inset-0 bg-yellow-500/5 animate-ping rounded-sm" />
      )}

      <div className="relative flex items-start gap-4">
        {/* Boss artwork / icon */}
        <div className="relative shrink-0 w-16 h-16 border-2 border-yellow-500 overflow-hidden">
          {artworkUrl && !isFogged ? (
            <Image src={artworkUrl} alt={stage.packName} fill sizes="64px" className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-yellow-900/30">
              <span className="text-2xl">{isFogged ? "🌫" : "⚡"}</span>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[10px] uppercase text-yellow-400 font-bold">
              ⚡ BOSS — Fase {stageNumber}
            </span>
            {completed && (
              <span className="font-mono text-[10px] uppercase text-green-400 font-bold">✓ Derrotado</span>
            )}
          </div>
          <p className="font-mono text-sm font-bold text-yellow-300 truncate">
            {isFogged ? "???" : narrative.stageName}
          </p>
          {!isFogged && (
            <>
              <p className="font-[var(--font-body)] text-xs text-[var(--pixel-subtext)] mt-1 line-clamp-2">
                {narrative.storyText}
              </p>
              <p className="font-mono text-[10px] text-yellow-600 mt-2 uppercase">
                {stage.packName}
              </p>
            </>
          )}
        </div>
      </div>
    </button>
  );
}
