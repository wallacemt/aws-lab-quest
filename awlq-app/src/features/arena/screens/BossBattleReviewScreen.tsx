"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AppLayout } from "@/components/layout/AppLayout";
import { PixelButton } from "@/components/ui/pixel-button";
import { PixelCard } from "@/components/ui/pixel-card";
import { QuestionReviewPanel, type QuestionReviewOption } from "@/features/study/components/QuestionReviewPanel";
import { QuestionOption } from "@/lib/types";

export type BossBattleSnapshotEntry = {
  questionId: string;
  statement: string;
  questionType: "single";
  selectedOption: string;
  correctOption: string;
  options: Record<string, string>;
  explanations: Record<string, string>;
  explanationSummary?: string;
};

type Props = {
  boss: { id: string; name: string; artworkUrl: string | null };
  gainedXp: number;
  correctCount: number;
  totalAnswered: number;
  finishedAt: string | null;
  answersSnapshot: BossBattleSnapshotEntry[];
};

type ReviewFilter = "all" | "wrong" | "correct";

export function BossBattleReviewScreen({
  boss,
  gainedXp,
  correctCount,
  totalAnswered,
  finishedAt,
  answersSnapshot,
}: Props) {
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const withResult = useMemo(
    () => answersSnapshot.map((item) => ({ ...item, correct: item.selectedOption === item.correctOption })),
    [answersSnapshot],
  );

  const filtered = useMemo(() => {
    if (filter === "wrong") return withResult.filter((item) => !item.correct);
    if (filter === "correct") return withResult.filter((item) => item.correct);
    return withResult;
  }, [filter, withResult]);

  const selected = filtered[Math.min(selectedIndex, Math.max(0, filtered.length - 1))] ?? null;

  const reviewOptions: QuestionReviewOption[] = selected
    ? Object.entries(selected.options).map(([option, text]) => ({
        option: option as QuestionOption,
        text,
        explanation: selected.explanations[option] ?? "Sem explicacao adicional.",
        isCorrect: option === selected.correctOption,
        isSelected: option === selected.selectedOption,
      }))
    : [];

  const wrongCount = withResult.filter((item) => !item.correct).length;

  function openNeighbor(delta: number) {
    setSelectedIndex((i) => Math.max(0, Math.min(filtered.length - 1, i + delta)));
  }

  function changeFilter(next: ReviewFilter) {
    setFilter(next);
    setSelectedIndex(0);
  }

  return (
    <AppLayout>
      <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8">
        <PixelCard className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded border-2 border-[var(--pixel-border)]">
                {boss.artworkUrl ? (
                  <Image
                    src={boss.artworkUrl}
                    alt={boss.name}
                    width={64}
                    height={64}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center bg-[var(--pixel-muted)] font-mono text-xl text-[var(--pixel-primary)]">
                    B
                  </div>
                )}
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase text-[var(--pixel-accent)]">Boss derrotado</p>
                <h1 className="font-[var(--font-body)] text-xl">{boss.name}</h1>
              </div>
            </div>
            <Link href="/arena">
              <PixelButton variant="ghost">Voltar a arena</PixelButton>
            </Link>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <span className="border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)] px-2 py-1">
              +{gainedXp} XP
            </span>
            <span className="border-2 border-[#2ecc71] bg-green-900/25 px-2 py-1">Corretas: {correctCount}</span>
            <span className="border-2 border-[#e74c3c] bg-red-900/25 px-2 py-1">Erradas: {wrongCount}</span>
            <span className="border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)] px-2 py-1">
              {totalAnswered} questões respondidas
            </span>
            {finishedAt && (
              <span className="border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)] px-2 py-1">
                {new Date(finishedAt).toLocaleString("pt-BR")}
              </span>
            )}
          </div>
        </PixelCard>

        <PixelCard className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Questões revisadas</p>
            <div className="flex flex-wrap gap-2">
              <PixelButton variant={filter === "all" ? "primary" : "ghost"} onClick={() => changeFilter("all")}>
                Todas
              </PixelButton>
              <PixelButton variant={filter === "wrong" ? "primary" : "ghost"} onClick={() => changeFilter("wrong")}>
                Erradas
              </PixelButton>
              <PixelButton
                variant={filter === "correct" ? "primary" : "ghost"}
                onClick={() => changeFilter("correct")}
              >
                Corretas
              </PixelButton>
            </div>
          </div>
          <p className="font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
            Exibindo {filtered.length} de {withResult.length} questões
          </p>
        </PixelCard>

        {!selected && (
          <PixelCard>
            <p className="font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
              Nenhuma questão encontrada para o filtro selecionado.
            </p>
          </PixelCard>
        )}

        {selected && (
          <PixelCard className="space-y-3">
            <QuestionReviewPanel
              isCorrect={selected.correct}
              summary={selected.explanationSummary}
              loading={false}
              options={reviewOptions}
              questionStatement={selected.statement}
              questionIndex={filtered.findIndex((item) => item.questionId === selected.questionId) + 1}
              questionCount={filtered.length}
            />
            <div className="flex flex-wrap justify-between gap-2">
              <PixelButton variant="ghost" onClick={() => openNeighbor(-1)}>
                Anterior
              </PixelButton>
              <PixelButton onClick={() => openNeighbor(1)}>Próxima</PixelButton>
            </div>
          </PixelCard>
        )}
      </main>
    </AppLayout>
  );
}
