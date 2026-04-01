"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { PixelButton } from "@/components/ui/pixel-button";
import { PixelCard } from "@/components/ui/pixel-card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SimuladoScoreGauge } from "@/features/study/components/SimuladoScoreGauge";
import { fetchStudyHistoryItemById, StudyHistoryItem } from "@/features/study/services";
import { normalizeOptionText } from "@/lib/study-option-text";
import { isCorrectAnswer, normalizeQuestionType } from "@/lib/study-answer-utils";

type ReviewFilter = "all" | "wrong" | "correct";

type SimuladoHistoryReviewScreenProps = {
  historyId: string;
};

export function SimuladoHistoryReviewScreen({ historyId }: SimuladoHistoryReviewScreenProps) {
  const [session, setSession] = useState<StudyHistoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [showExplanations, setShowExplanations] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      setLoading(true);
      setError(null);

      try {
        const payload = await fetchStudyHistoryItemById(historyId);
        if (payload.sessionType !== "SIMULADO") {
          throw new Error("Este item nao pertence a um simulado.");
        }

        if (!cancelled) {
          setSession(payload);
          setSelectedQuestionId(payload.answersSnapshot[0]?.questionId ?? null);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : "Erro ao carregar revisao do simulado.");
          setSession(null);
          setSelectedQuestionId(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadSession();

    return () => {
      cancelled = true;
    };
  }, [historyId]);

  const snapshots = useMemo(() => session?.answersSnapshot ?? [], [session?.answersSnapshot]);

  const snapshotsWithResult = useMemo(
    () =>
      snapshots.map((item) => {
        const questionType = normalizeQuestionType(item.questionType);
        const correct = isCorrectAnswer({
          questionType,
          selectedOption: item.selectedOption,
          selectedOptions: item.selectedOptions,
          correctOption: item.correctOption,
          correctOptions: item.correctOptions,
        });

        return {
          ...item,
          questionType,
          correct,
        };
      }),
    [snapshots],
  );

  const filteredSnapshots = useMemo(() => {
    if (filter === "wrong") {
      return snapshotsWithResult.filter((item) => !item.correct);
    }

    if (filter === "correct") {
      return snapshotsWithResult.filter((item) => item.correct);
    }

    return snapshotsWithResult;
  }, [filter, snapshotsWithResult]);

  const selectedIndex = filteredSnapshots.findIndex((item) => item.questionId === selectedQuestionId);
  const selectedQuestion = selectedIndex >= 0 ? filteredSnapshots[selectedIndex] : (filteredSnapshots[0] ?? null);

  useEffect(() => {
    if (filteredSnapshots.length === 0) {
      setSelectedQuestionId(null);
      return;
    }

    if (!selectedQuestionId || !filteredSnapshots.some((item) => item.questionId === selectedQuestionId)) {
      setSelectedQuestionId(filteredSnapshots[0].questionId);
    }
  }, [filteredSnapshots, selectedQuestionId]);

  function openNeighborQuestion(delta: number) {
    if (!selectedQuestion || filteredSnapshots.length === 0) {
      return;
    }

    const current = filteredSnapshots.findIndex((item) => item.questionId === selectedQuestion.questionId);
    if (current < 0) {
      return;
    }

    const nextIndex = Math.max(0, Math.min(filteredSnapshots.length - 1, current + delta));
    setSelectedQuestionId(filteredSnapshots[nextIndex].questionId);
  }

  const wrongCount = snapshotsWithResult.filter((item) => !item.correct).length;
  const correctCount = snapshotsWithResult.filter((item) => item.correct).length;
  const scorePoints = session
    ? session.totalQuestions > 0
      ? Math.round((session.correctAnswers / session.totalQuestions) * 1000)
      : Math.round((session.scorePercent / 100) * 1000)
    : 0;

  return (
    <AppLayout>
      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 xl:px-8">
        <PixelCard className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-mono text-[10px] uppercase text-[var(--pixel-accent)]">Revisao de Simulado</p>
              <h1 className="font-[var(--font-body)] text-2xl">Overview da prova finalizada</h1>
            </div>
            <Link href="/history">
              <PixelButton variant="ghost">Voltar ao historico</PixelButton>
            </Link>
          </div>

          {loading && (
            <p className="font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">Carregando revisao...</p>
          )}

          {error && !loading && <p className="font-[var(--font-body)] text-sm text-red-300">{error}</p>}

          {session && !loading && (
            <div className="space-y-3">
              <p className="font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
                {session.title} · {session.certificationCode ?? "Certificacao nao definida"} ·{" "}
                {new Date(session.completedAt).toLocaleString("pt-BR")}
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)] px-2 py-1">
                  Score {session.scorePercent}%
                </span>
                <span className="border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)] px-2 py-1">
                  {session.correctAnswers}/{session.totalQuestions} corretas
                </span>
                <span className="border-2 border-[#2ecc71] bg-green-900/25 px-2 py-1">Corretas: {correctCount}</span>
                <span className="border-2 border-[#e74c3c] bg-red-900/25 px-2 py-1">Erradas: {wrongCount}</span>
                {session.durationSeconds != null && (
                  <span className="border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)] px-2 py-1">
                    {Math.floor(session.durationSeconds / 60)}m {session.durationSeconds % 60}s
                  </span>
                )}
              </div>

              <SimuladoScoreGauge points={scorePoints} maxPoints={1000} minimumCertificationPoints={700} />
            </div>
          )}
        </PixelCard>

        {!loading && !error && session && (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <section className="space-y-4">
              <PixelCard className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Painel de revisao</p>
                  <div className="flex flex-wrap gap-2">
                    <PixelButton variant={filter === "all" ? "primary" : "ghost"} onClick={() => setFilter("all")}>
                      Todas
                    </PixelButton>
                    <PixelButton variant={filter === "wrong" ? "primary" : "ghost"} onClick={() => setFilter("wrong")}>
                      Erradas
                    </PixelButton>
                    <PixelButton
                      variant={filter === "correct" ? "primary" : "ghost"}
                      onClick={() => setFilter("correct")}
                    >
                      Corretas
                    </PixelButton>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
                    Exibindo {filteredSnapshots.length} de {snapshotsWithResult.length} questoes
                  </p>
                  <PixelButton variant="ghost" onClick={() => setShowExplanations((prev) => !prev)}>
                    {showExplanations ? "Ocultar explicacoes" : "Mostrar explicacoes"}
                  </PixelButton>
                </div>
              </PixelCard>

              {!selectedQuestion && (
                <PixelCard>
                  <p className="font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
                    Nenhuma questao encontrada para o filtro selecionado.
                  </p>
                </PixelCard>
              )}

              {selectedQuestion && (
                <PixelCard className="space-y-3">
                  <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">
                    Questao {selectedIndex + 1} de {filteredSnapshots.length}
                  </p>
                  <p className="font-[var(--font-body)] text-base">{selectedQuestion.statement}</p>
                  <p className="font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">
                    {selectedQuestion.questionType === "multi" ? "Tipo multipla escolha" : "Tipo escolha unica"} ·{" "}
                    Resultado: {selectedQuestion.correct ? "correta" : "incorreta"}
                  </p>

                  <div className="space-y-2">
                    {Object.entries(selectedQuestion.options)
                      .map(([option, optionText]) => ({ option, text: normalizeOptionText(optionText) }))
                      .filter((item) => item.text.length > 0)
                      .map(({ option, text }) => {
                        const selectedLabels = Array.isArray(selectedQuestion.selectedOptions)
                          ? selectedQuestion.selectedOptions
                          : [selectedQuestion.selectedOption];
                        const correctLabels = Array.isArray(selectedQuestion.correctOptions)
                          ? selectedQuestion.correctOptions
                          : [selectedQuestion.correctOption];
                        const isSelected = selectedLabels.includes(option);
                        const isCorrectOption = correctLabels.includes(option);
                        const isWrongSelected = isSelected && !isCorrectOption;

                        return (
                          <div
                            key={`${selectedQuestion.questionId}-${option}`}
                            className={`space-y-1 border-2 px-2 py-2 ${
                              isCorrectOption
                                ? "border-[#2ecc71] bg-green-900/25"
                                : isWrongSelected
                                  ? "border-[#e74c3c] bg-red-900/25"
                                  : "border-[var(--pixel-border)] bg-[var(--pixel-card)]"
                            }`}
                          >
                            <p className="font-[var(--font-body)] text-xs">
                              {option}) {text}
                              {isCorrectOption ? " · correta" : ""}
                              {isSelected ? " · sua resposta" : ""}
                            </p>
                            {showExplanations && (
                              <p className="font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">
                                {selectedQuestion.explanations[option] ?? "Sem explicacao adicional."}
                              </p>
                            )}
                          </div>
                        );
                      })}
                  </div>

                  <div className="flex flex-wrap justify-between gap-2">
                    <PixelButton variant="ghost" onClick={() => openNeighborQuestion(-1)}>
                      Anterior
                    </PixelButton>
                    <PixelButton onClick={() => openNeighborQuestion(1)}>Proxima</PixelButton>
                  </div>
                </PixelCard>
              )}
            </section>

            <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
              <PixelCard className="space-y-3">
                <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Navegacao por questao</p>
                <ScrollArea className="h-72 w-full rounded-md border border-pixel-border">
                  <div className="grid grid-cols-5 gap-2 p-3">
                    {filteredSnapshots.map((item, index) => {
                      const isCurrent = item.questionId === selectedQuestion?.questionId;
                      return (
                        <button
                          key={`${item.questionId}-${index}`}
                          type="button"
                          onClick={() => setSelectedQuestionId(item.questionId)}
                          className={`border px-2 py-2 font-mono text-[10px] uppercase ${
                            isCurrent
                              ? "border-[var(--pixel-primary)] bg-[var(--pixel-primary)]/20"
                              : item.correct
                                ? "border-[#2ecc71] bg-green-900/20"
                                : "border-[#e74c3c] bg-red-900/20"
                          }`}
                        >
                          {index + 1}
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </PixelCard>
            </aside>
          </div>
        )}
      </main>
    </AppLayout>
  );
}
