"use client";

import { useState } from "react";
import { PixelCard } from "@/components/ui/pixel-card";
import { getTaskXpByDifficulty } from "@/lib/levels";
import { Task } from "@/lib/types";

const DIFFICULTY_LABEL: Record<"easy" | "medium" | "hard", string> = {
  easy: "Facil",
  medium: "Media",
  hard: "Dificil",
};

export function TaskCard({
  task,
  onToggle,
  index,
}: {
  task: Task;
  onToggle: (taskId: number, checked: boolean) => void;
  index: number;
}) {
  const [showHints, setShowHints] = useState(false);
  const difficulty = task.difficulty ?? "medium";
  const taskXp = getTaskXpByDifficulty(difficulty);

  return (
    <PixelCard className={`${task.completed ? "bg-green-900/60" : ""} flex h-full flex-col space-y-3`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] text-[var(--pixel-primary)]">MISSAO {index + 1}</p>
          <h3 className="font-[var(--font-body)] text-lg">{task.title}</h3>
          <p className="font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">{task.mission}</p>
        </div>
        <input
          aria-label={`Concluir ${task.title}`}
          type="checkbox"
          checked={Boolean(task.completed)}
          onChange={(e) => onToggle(task.id, e.target.checked)}
          className="h-6 w-6 accent-[var(--pixel-accent)]"
        />
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <span className="border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)] px-2 py-1">+{taskXp} XP</span>
        <span className="border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)] px-2 py-1">
          {DIFFICULTY_LABEL[difficulty]}
        </span>
        <span className="border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)] px-2 py-1">{task.service}</span>
      </div>

      <p className="border-2 border-violet-400/80 bg-violet-900/20 p-2 font-[var(--font-body)] text-sm leading-relaxed">
        {task.analogy}
      </p>

      <button
        onClick={() => setShowHints((value) => !value)}
        className="mt-auto text-left font-mono text-[10px] uppercase text-[var(--pixel-primary)]"
      >
        {showHints ? "Ocultar Dicas" : "Ver Dicas"}
      </button>

      {showHints ? (
        <ul className="space-y-1 border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)] p-3">
          {task.steps.map((step) => (
            <li key={step} className="font-[var(--font-body)] text-sm">
              - {step}
            </li>
          ))}
        </ul>
      ) : null}
    </PixelCard>
  );
}
