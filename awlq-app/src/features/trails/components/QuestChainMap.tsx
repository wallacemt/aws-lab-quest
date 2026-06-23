"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { PixelButton } from "@/components/ui/pixel-button";
import { TrailStudyFlow } from "@/features/trails/components/TrailStudyFlow";
import { type QuestChain, type QuestStage } from "@/features/trails/services/trails-api";

// ─── Stage state ──────────────────────────────────────────────────────────────

type StageState = "locked" | "unlocked" | "completed";

function getStageState(stage: QuestStage): StageState {
  if (stage.completed) return "completed";
  if (stage.unlocked) return "unlocked";
  return "locked";
}

// ─── Dotted path connector ────────────────────────────────────────────────────

type ConnectorProps = {
  direction: "right" | "left";
  active: boolean;
};

/**
 * CSS-only curved dotted connector between stages.
 * direction="right" → curves from left to right (bottom-right arc)
 * direction="left"  → curves from right to left (bottom-left arc)
 */
function PathConnector({ direction, active }: ConnectorProps) {
  const color = active ? "border-[var(--pixel-accent)]" : "border-[var(--pixel-border)]";

  return (
    <div className="relative h-14 w-full mx-2 my-1">
      {direction === "right" ? (
        <div
          className={`absolute inset-x-[20%] top-0 bottom-0 border-r-2 border-b-2 border-dashed ${color}`}
          style={{ borderRadius: "0 0 40px 0" }}
        />
      ) : (
        <div
          className={`absolute inset-x-[20%] top-0 bottom-0 border-l-2 border-b-2 border-dashed ${color}`}
          style={{ borderRadius: "0 0 0 40px" }}
        />
      )}
    </div>
  );
}

// ─── Stage node ───────────────────────────────────────────────────────────────

type StageNodeProps = {
  stage: QuestStage;
  chainId: string;
  align: "left" | "right";
  onTooltip: (msg: string) => void;
  onStudy: (stage: QuestStage) => void;
  onStageCompleted: (stageId: string, unlockedNextId: string | undefined) => void;
};

const CIRCLE_STYLES: Record<StageState, string> = {
  locked:
    "border-[var(--pixel-border)] bg-[var(--pixel-card)] text-[var(--pixel-muted)] opacity-60",
  unlocked:
    "border-[var(--pixel-accent)] bg-[var(--pixel-card)] text-[var(--pixel-accent)] shadow-[0_0_12px_rgba(var(--pixel-accent-rgb),0.3)]",
  completed:
    "border-[var(--pixel-accent)] bg-[var(--pixel-accent)] text-[var(--pixel-bg)]",
};

function StageNode({ stage, chainId, align, onTooltip, onStudy, onStageCompleted }: StageNodeProps) {
  const state = getStageState(stage);
  const isLeft = align === "left";

  return (
    <div className={`flex items-center gap-3 w-full ${isLeft ? "flex-row" : "flex-row-reverse"}`}>
      {/* Circle */}
      <div
        className={`flex h-14 w-14 shrink-0 items-center justify-center border-2 font-mono text-sm font-bold transition-all ${CIRCLE_STYLES[state]}`}
        style={{ clipPath: "none" }}
      >
        {state === "completed" ? (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : state === "locked" ? (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        ) : (
          <span>{stage.position}</span>
        )}
      </div>

      {/* Info card */}
      <div
        className={`flex-1 border border-[var(--pixel-border)] bg-[var(--pixel-card)] p-3 ${
          state === "locked" ? "opacity-60" : ""
        }`}
      >
        <p className="font-mono text-xs font-bold text-[var(--pixel-text)] leading-tight">{stage.title}</p>
        {stage.awsServiceId && (
          <p className="font-mono text-[10px] text-[var(--pixel-muted)] uppercase mt-0.5">
            {stage.awsServiceId}
          </p>
        )}

        {/* Actions */}
        <div className={`mt-2 flex gap-2 ${isLeft ? "" : "flex-row-reverse"}`}>
          {state === "locked" && (
            <button
              type="button"
              onClick={() => onTooltip(`Complete o estágio anterior para desbloquear "${stage.title}"`)}
              className="font-mono text-[10px] text-[var(--pixel-muted)] underline"
            >
              Bloqueado
            </button>
          )}

          {state === "unlocked" && (
            <PixelButton className="text-[10px] py-1 px-2" onClick={() => onStudy(stage)}>
              Estudar
            </PixelButton>
          )}

          {state === "completed" && (
            <PixelButton
              variant="ghost"
              className="text-[10px] py-1 px-2 text-[var(--pixel-accent)]"
              onClick={() => onStudy(stage)}
            >
              Revisar
            </PixelButton>
          )}
        </div>
      </div>
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
 * Renders a QuestChain as a vertical zigzag game-world path.
 *
 * Stages alternate left/right alignment, connected by CSS-curved dashed lines.
 * Unlocked stages open TrailStudyFlow (AI explanation + 10-question quiz).
 * Completed stages show "Revisar" to re-read the explanation.
 */
export function QuestChainMap({ chain, tooltip, onShowTooltip, onStageCompleted }: Props) {
  const [studyStage, setStudyStage] = useState<QuestStage | null>(null);

  if (chain.stages.length === 0) {
    return (
      <p className="font-mono text-xs text-[var(--pixel-muted)]">
        Esta trilha não possui estágios ainda.
      </p>
    );
  }

  function handleStudyCompleted(stageId: string, unlockedNextId: string | undefined) {
    onStageCompleted(stageId, unlockedNextId);
  }

  return (
    <>
      <div className="space-y-1 py-2">
        {chain.stages.map((stage, idx) => {
          const align: "left" | "right" = idx % 2 === 0 ? "left" : "right";
          const nextStage = chain.stages[idx + 1];
          const connectorActive = nextStage?.unlocked ?? false;
          const connectorDirection: "right" | "left" = align === "left" ? "right" : "left";

          return (
            <div key={stage.id}>
              <StageNode
                stage={stage}
                chainId={chain.id}
                align={align}
                onTooltip={onShowTooltip}
                onStudy={setStudyStage}
                onStageCompleted={onStageCompleted}
              />
              {idx < chain.stages.length - 1 && (
                <PathConnector
                  direction={connectorDirection}
                  active={connectorActive}
                />
              )}
            </div>
          );
        })}
      </div>

      {tooltip && (
        <p className="mt-2 font-mono text-xs text-[var(--pixel-muted)]">{tooltip}</p>
      )}

      {/* Study flow modal */}
      <AnimatePresence>
        {studyStage && (
          <TrailStudyFlow
            chainId={chain.id}
            stage={studyStage}
            onClose={() => setStudyStage(null)}
            onCompleted={(stageId, unlockedNextId) => {
              setStudyStage(null);
              handleStudyCompleted(stageId, unlockedNextId);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
