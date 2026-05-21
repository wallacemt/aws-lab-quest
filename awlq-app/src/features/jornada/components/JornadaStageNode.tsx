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

export function JornadaStageNode({ stage, isCurrent, isFogged, onSelect }: Props) {
  const { completed, isBoss, stageNumber, narrative, artworkUrl } = stage;

  const borderColor = completed
    ? "border-green-500"
    : isCurrent
      ? "border-[var(--pixel-primary)] animate-pulse"
      : isFogged
        ? "border-[var(--pixel-border)] opacity-40"
        : "border-[var(--pixel-border)]";

  const bgColor = completed
    ? "bg-green-900/30"
    : isCurrent
      ? "bg-[var(--pixel-primary)]/10"
      : "bg-[var(--pixel-bg)]";

  const statusIcon = completed ? "✓" : isCurrent ? "▶" : isFogged ? "?" : "○";
  const statusColor = completed ? "text-green-400" : isCurrent ? "text-[var(--pixel-primary)]" : "text-[var(--pixel-subtext)]";

  return (
    <button
      type="button"
      onClick={() => !isFogged && onSelect(stage)}
      disabled={isFogged}
      className={`w-full text-left border-2 p-3 transition-colors ${borderColor} ${bgColor} ${isFogged ? "cursor-not-allowed" : "hover:border-[var(--pixel-primary)]/70"}`}
    >
      <div className="flex items-start gap-3">
        {/* Artwork thumbnail or placeholder */}
        <div className="relative shrink-0 w-12 h-12 border border-[var(--pixel-border)] overflow-hidden">
          {artworkUrl && !isFogged ? (
            <Image src={artworkUrl} alt={stage.packName} fill sizes="48px" className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-[var(--pixel-muted)]">
              <span className={`font-mono text-lg ${statusColor}`}>{statusIcon}</span>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">
              Fase {stageNumber}
            </span>
            <span className={`font-mono text-[10px] uppercase font-bold ${statusColor}`}>
              {statusIcon}
            </span>
          </div>
          <p className="font-mono text-xs font-bold text-[var(--pixel-primary)] truncate">
            {isFogged ? "???" : narrative.stageName}
          </p>
          {!isFogged && (
            <p className="font-[var(--font-body)] text-[10px] text-[var(--pixel-subtext)] truncate">
              {stage.packName}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}
