"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { completeStage, type QuestChain, type QuestStage } from "@/features/trails/services/trails-api";

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
  completed: "border-[var(--pixel-accent)] bg-[var(--pixel-accent)] text-[var(--pixel-bg)] cursor-default",
};

type StageNodeProps = {
  stage: QuestStage;
  chainId: string;
  onNavigate: (href: string) => void;
  onTooltip: (message: string) => void;
  onStageCompleted: (stageId: string, unlockedNextId: string | undefined) => void;
};

function StageNode({ stage, chainId, onNavigate, onTooltip, onStageCompleted }: StageNodeProps) {
  const state = getStageState(stage);
  const [isCompleting, setIsCompleting] = useState(false);

  const studyHref = (() => {
    const target = stage.awsServiceId ?? stage.topic;
    return target ? `/kc?service=${encodeURIComponent(target)}` : "/kc";
  })();

  const handleLocked = () => {
    onTooltip(`Complete o estágio anterior para desbloquear "${stage.title}"`);
  };

  const handleMarkComplete = async () => {
    setIsCompleting(true);
    try {
      const result = await completeStage(chainId, stage.id);
      onStageCompleted(stage.id, result.unlockedNext);
    } catch (err) {
      onTooltip(err instanceof Error ? err.message : "Erro ao marcar estágio como concluído.");
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Circle indicator — clickable only when locked (shows tooltip) */}
      {state === "locked" ? (
        <button
          type="button"
          onClick={handleLocked}
          className={`flex h-14 w-14 items-center justify-center rounded-full border-2 font-mono text-xs font-bold transition-colors ${STATE_STYLES.locked}`}
          aria-label={`${stage.title} — bloqueado`}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </button>
      ) : (
        <div
          className={`flex h-14 w-14 items-center justify-center rounded-full border-2 font-mono text-xs font-bold ${STATE_STYLES[state]}`}
          aria-label={`${stage.title} — ${state === "completed" ? "concluído" : "desbloqueado"}`}
        >
          {state === "completed" ? (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            stage.position.toString()
          )}
        </div>
      )}

      {/* Stage title */}
      <span className="max-w-[4.5rem] text-center font-mono text-[10px] leading-tight text-[var(--pixel-muted)]">
        {stage.title}
      </span>

      {/* Action buttons — only shown for unlocked (not yet completed) stages */}
      {state === "unlocked" && (
        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={() => onNavigate(studyHref)}
            className="rounded border border-[var(--pixel-accent)] px-2 py-0.5 font-mono text-[9px] text-[var(--pixel-accent)] hover:bg-[var(--pixel-accent)]/10"
          >
            Estudar
          </button>
          <button
            type="button"
            onClick={() => void handleMarkComplete()}
            disabled={isCompleting}
            className="rounded border border-[var(--pixel-muted)] px-2 py-0.5 font-mono text-[9px] text-[var(--pixel-muted)] hover:bg-[var(--pixel-muted)]/10 disabled:opacity-50"
          >
            {isCompleting ? "..." : "Concluído"}
          </button>
        </div>
      )}

      {/* Completed badge — no action buttons */}
      {state === "completed" && (
        <span className="font-mono text-[9px] text-[var(--pixel-accent)]">Concluído</span>
      )}
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
  onStageCompleted: (stageId: string, unlockedNextId: string | undefined) => void;
};

/**
 * Renders a QuestChain as a linear stage map.
 *
 * Each stage is a circle showing its state: locked (grey + lock icon),
 * unlocked (accent outline + number), or completed (filled + checkmark).
 *
 * Unlocked stages expose two buttons:
 *   - "Estudar" — navigates to the KC page for the stage's AWS service.
 *   - "Concluído" — POSTs to /api/trails/[chainId]/progress and notifies the
 *     parent via onStageCompleted so it can update state optimistically.
 *
 * Completed stages show only a "Concluído" badge; locked stages show a tooltip
 * explaining what needs to be done first.
 */
export function QuestChainMap({ chain, tooltip, onShowTooltip, onStageCompleted }: Props) {
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
              chainId={chain.id}
              onNavigate={(href) => router.push(href)}
              onTooltip={onShowTooltip}
              onStageCompleted={onStageCompleted}
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
