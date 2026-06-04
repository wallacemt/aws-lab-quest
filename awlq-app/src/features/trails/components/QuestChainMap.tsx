"use client";

import { useRouter } from "next/navigation";
import type { QuestChain, QuestStage } from "@/features/trails/services/trails-api";

// ─── Stage state derivation ───────────────────────────────────────────────────

type StageState = "locked" | "unlocked" | "completed";

function getStageState(stage: QuestStage): StageState {
  if (stage.completed) return "completed";
  if (stage.unlocked) return "unlocked";
  return "locked";
}

// ─── Stage node ───────────────────────────────────────────────────────────────

const STATE_STYLES: Record<StageState, string> = {
  locked: "border-[var(--pixel-border)] bg-[var(--pixel-surface)] text-[var(--pixel-muted)] cursor-not-allowed opacity-60",
  unlocked: "border-[var(--pixel-accent)] bg-[var(--pixel-surface)] text-[var(--pixel-accent)] cursor-pointer hover:bg-[var(--pixel-accent)]/10",
  completed: "border-[var(--pixel-accent)] bg-[var(--pixel-accent)] text-[var(--pixel-bg)] cursor-pointer",
};

type StageNodeProps = {
  stage: QuestStage;
  onNavigate: (href: string) => void;
  onTooltip: (message: string) => void;
};

function StageNode({ stage, onNavigate, onTooltip }: StageNodeProps) {
  const state = getStageState(stage);

  const handleClick = () => {
    if (state === "locked") {
      onTooltip(`Complete o estágio anterior para desbloquear "${stage.title}"`);
      return;
    }

    const target = stage.awsServiceId ?? stage.topic;
    const href = target ? `/kc?service=${encodeURIComponent(target)}` : "/kc";
    onNavigate(href);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        className={`flex h-14 w-14 items-center justify-center rounded-full border-2 font-mono text-xs font-bold transition-colors ${STATE_STYLES[state]}`}
        aria-label={`${stage.title} — ${state}`}
      >
        {state === "completed" ? (
          // Checkmark for completed stages
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : state === "locked" ? (
          // Lock icon for locked stages
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        ) : (
          stage.position.toString()
        )}
      </button>
      <span className="max-w-[4.5rem] text-center font-mono text-[10px] leading-tight text-[var(--pixel-muted)]">
        {stage.title}
      </span>
    </div>
  );
}

// ─── Connector arrow ─────────────────────────────────────────────────────────

function StageConnector({ unlocked }: { unlocked: boolean }) {
  return (
    <div className="flex flex-1 items-center px-1">
      <div
        className={`h-0.5 w-full ${
          unlocked ? "bg-[var(--pixel-accent)]" : "bg-[var(--pixel-border)]"
        }`}
      />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type Props = {
  chain: QuestChain;
  tooltip: string | null;
  onShowTooltip: (message: string) => void;
};

/**
 * Renders a QuestChain as a linear stage map.
 *
 * Each stage is a circle showing its state: locked (grey + lock icon),
 * unlocked (accent outline + number), or completed (filled + checkmark).
 * Clicking an unlocked/completed stage navigates to the KC for that service.
 * Clicking a locked stage shows a tooltip explaining what to complete first.
 */
export function QuestChainMap({ chain, tooltip, onShowTooltip }: Props) {
  const router = useRouter();

  if (chain.stages.length === 0) {
    return (
      <p className="font-mono text-xs text-[var(--pixel-muted)]">
        Esta trilha não possui estágios ainda.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* Stage map row */}
      <div className="flex items-start overflow-x-auto pb-2">
        {chain.stages.map((stage, idx) => (
          <div key={stage.id} className="flex items-center">
            <StageNode
              stage={stage}
              onNavigate={(href) => router.push(href)}
              onTooltip={onShowTooltip}
            />
            {idx < chain.stages.length - 1 && (
              <StageConnector unlocked={chain.stages[idx + 1]?.unlocked ?? false} />
            )}
          </div>
        ))}
      </div>

      {/* Tooltip / hint message */}
      {tooltip && (
        <p className="font-mono text-xs text-[var(--pixel-muted)]">{tooltip}</p>
      )}
    </div>
  );
}
