"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { PixelButton } from "@/components/ui/pixel-button";
import { PixelCard } from "@/components/ui/pixel-card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { QuestionReviewPanel } from "@/features/study/components/QuestionReviewPanel";
import { SimuladoScoreGauge } from "@/features/study/components/SimuladoScoreGauge";
import { SimuladoResultOverview } from "@/features/study/components/simulado/SimuladoResultOverview";
import {
  createStudyExplanation,
  fetchWeakServices,
  fetchStudyHistoryItemById,
  saveStudyHistoryExplanation,
  StudyHistoryItem,
  WeakServiceItem,
} from "@/features/study/services";
import { hasSubstantialStaticExplanation } from "@/features/utils/funcs/simulado-utils";
import { normalizeOptionText } from "@/lib/study-option-text";
import { isCorrectAnswer, normalizeQuestionType } from "@/lib/study-answer-utils";
import { QuestionOption } from "@/lib/types";

type ReviewFilter = "all" | "wrong" | "correct";
type ResultTab = "score" | "review" | "gaps";

type ExplanationCacheItem = {
  summary: string;
  options: Partial<Record<QuestionOption, string>>;
};

type SimuladoHistoryReviewScreenProps = {
  historyId: string;
};

export function SimuladoHistoryReviewScreen({ historyId }: SimuladoHistoryReviewScreenProps) {
  const [session, setSession] = useState<StudyHistoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resultTab, setResultTab] = useState<ResultTab>("score");
  const [historicalWeakServices, setHistoricalWeakServices] = useState<WeakServiceItem[]>([]);
  const [nextStepsOpen, setNextStepsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [showExplanations, setShowExplanations] = useState(true);
  const [loadingExplanationByQuestion, setLoadingExplanationByQuestion] = useState<Record<string, boolean>>({});
  const [failedExplanationByQuestion, setFailedExplanationByQuestion] = useState<Record<string, boolean>>({});
  const [removedFromDbByQuestion, setRemovedFromDbByQuestion] = useState<Record<string, boolean>>({});
  const [explanationCacheByQuestion, setExplanationCacheByQuestion] = useState<Record<string, ExplanationCacheItem>>(
    {},
  );
  const isMountedRef = useRef(true);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const inFlightExplanationRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  function isOptionKey(value: unknown): value is QuestionOption {
    return value === "A" || value === "B" || value === "C" || value === "D" || value === "E";
  }

  function hasSummaryOrExplanation(item: { explanationSummary?: string; explanations: Record<string, string>; correctOption: string }): boolean {
    return Boolean(item.explanationSummary?.trim()) || hasSubstantialStaticExplanation(item.explanations[item.correctOption]);
  }

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
          setLoadingExplanationByQuestion({});
          setFailedExplanationByQuestion({});
          setExplanationCacheByQuestion({});
          setRemovedFromDbByQuestion({});
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
  const selectedCachedExplanation = selectedQuestion
    ? explanationCacheByQuestion[selectedQuestion.questionId]
    : undefined;
  const selectedSummary = selectedCachedExplanation?.summary ?? selectedQuestion?.explanationSummary;
  const selectedReviewOptions = useMemo(() => {
    if (!selectedQuestion) {
      return [];
    }

    const selectedLabels = Array.isArray(selectedQuestion.selectedOptions)
      ? selectedQuestion.selectedOptions
      : [selectedQuestion.selectedOption];
    const correctLabels = Array.isArray(selectedQuestion.correctOptions)
      ? selectedQuestion.correctOptions
      : [selectedQuestion.correctOption];

    return (Object.entries(selectedQuestion.options)
      .map(([option, optionText]) => ({
        option,
        text: normalizeOptionText(optionText),
      }))
      .filter((item) => item.text.length > 0)
      .map(({ option, text }) => ({
        option: option as QuestionOption,
        text,
        explanation:
          selectedCachedExplanation?.options?.[option as QuestionOption] ??
          selectedQuestion.explanations[option] ??
          "Sem explicacao adicional.",
        isCorrect: correctLabels.includes(option),
        isSelected: selectedLabels.includes(option),
      })) ?? []) as Array<{
      option: QuestionOption;
      text: string;
      explanation: string;
      isCorrect: boolean;
      isSelected: boolean;
    }>;
  }, [selectedCachedExplanation, selectedQuestion]);

  useEffect(() => {
    if (filteredSnapshots.length === 0) {
      setSelectedQuestionId(null);
      return;
    }

    if (!selectedQuestionId || !filteredSnapshots.some((item) => item.questionId === selectedQuestionId)) {
      setSelectedQuestionId(filteredSnapshots[0].questionId);
    }
  }, [filteredSnapshots, selectedQuestionId]);

  useEffect(() => {
    if (!selectedQuestion) {
      return;
    }

    const questionId = selectedQuestion.questionId;

    if (inFlightExplanationRef.current[questionId]) {
      return;
    }

    if (failedExplanationByQuestion[questionId]) {
      return;
    }

    if (selectedCachedExplanation?.summary?.trim()) {
      return;
    }

    if (hasSummaryOrExplanation(selectedQuestion)) {
      return;
    }

    const fallbackSummary = "Revisao local baseada no gabarito da questao.";

    async function generateAndPersist() {
      const selectedOptions = Array.isArray(selectedQuestion.selectedOptions)
        ? selectedQuestion.selectedOptions.filter((option): option is QuestionOption => isOptionKey(option))
        : [];

      const selectedOption = isOptionKey(selectedQuestion.selectedOption)
        ? selectedQuestion.selectedOption
        : (selectedOptions[0] ?? "A");

      inFlightExplanationRef.current[questionId] = true;
      setLoadingExplanationByQuestion((prev) => ({
        ...prev,
        [questionId]: true,
      }));

      try {
        const generated = await createStudyExplanation({
          questionId,
          selectedOption,
          selectedOptions: selectedQuestion.questionType === "multi" ? selectedOptions : undefined,
          optionMapping: selectedQuestion.optionMapping,
        });

        if (isMountedRef.current) {
          setExplanationCacheByQuestion((prev) => ({
            ...prev,
            [questionId]: {
              summary: generated.summary,
              options: generated.options,
            },
          }));
        }

        if (isMountedRef.current) {
          setSession((previous) => {
            if (!previous) {
              return previous;
            }

            return {
              ...previous,
              answersSnapshot: previous.answersSnapshot.map((answer) => {
                if (answer.questionId !== questionId) {
                  return answer;
                }

                return {
                  ...answer,
                  explanationSummary: generated.summary,
                  explanations: {
                    ...answer.explanations,
                    ...generated.options,
                  },
                };
              }),
            };
          });
        }

        await saveStudyHistoryExplanation({
          historyId,
          questionId,
          explanationSummary: generated.summary,
          explanations: generated.options,
        });
      } catch (explanationError: unknown) {
        const isNotFound =
          explanationError instanceof Error &&
          (explanationError.message.toLowerCase().includes("nao encontrada") ||
            explanationError.message.toLowerCase().includes("não encontrada") ||
            explanationError.message.toLowerCase().includes("not found"));
        if (isMountedRef.current && isNotFound) {
          setRemovedFromDbByQuestion((prev) => ({ ...prev, [questionId]: true }));
        }
        if (isMountedRef.current) {
          setFailedExplanationByQuestion((prev) => ({
            ...prev,
            [questionId]: true,
          }));

          setExplanationCacheByQuestion((prev) => ({
            ...prev,
            [questionId]: {
              summary: fallbackSummary,
              options: selectedQuestion.explanations,
            },
          }));

          setSession((previous) => {
            if (!previous) {
              return previous;
            }

            return {
              ...previous,
              answersSnapshot: previous.answersSnapshot.map((answer) => {
                if (answer.questionId !== questionId) {
                  return answer;
                }

                return {
                  ...answer,
                  explanationSummary: answer.explanationSummary || fallbackSummary,
                };
              }),
            };
          });
        }
      } finally {
        inFlightExplanationRef.current[questionId] = false;
        if (isMountedRef.current) {
          setLoadingExplanationByQuestion((prev) => ({
            ...prev,
            [questionId]: false,
          }));
        }
      }
    }

    void generateAndPersist();
  }, [failedExplanationByQuestion, historyId, selectedCachedExplanation, selectedQuestion]);

  function handleRetryExplanation(questionId: string) {
    inFlightExplanationRef.current[questionId] = false;
    setFailedExplanationByQuestion((prev) => {
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
    setExplanationCacheByQuestion((prev) => {
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
    // Clear the fallback summary so hasSummaryOrExplanation returns false and the useEffect retries
    setSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        answersSnapshot: prev.answersSnapshot.map((a) =>
          a.questionId !== questionId ? a : { ...a, explanationSummary: "" },
        ),
      };
    });
  }

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
  const exportPayload = useMemo(() => session ? ({
    metadata: {
      title: session.title,
      certificationCode: session.certificationCode ?? null,
      completedAt: session.completedAt,
      durationSeconds: session.durationSeconds ?? null,
      scorePercent: session.scorePercent,
      correctAnswers: session.correctAnswers,
      totalQuestions: session.totalQuestions,
      packName: session.packName ?? null,
    },
    score: { points: scorePoints, maxPoints: 1000, minimumCertificationPoints: 700 },
    metrics: { totalQuestions: snapshotsWithResult.length, correctAnswers: correctCount, wrongAnswers: wrongCount },
    questions: snapshotsWithResult.map((item) => ({
      questionId: item.questionId,
      statement: item.statement,
      questionType: item.questionType ?? null,
      options: item.options,
      correctOption: item.correctOption,
      correctOptions: item.correctOptions ?? null,
      userAnswer: item.selectedOptions ?? item.selectedOption,
      isCorrect: item.correct,
      explanationSummary: item.explanationSummary ?? null,
      explanations: item.explanations,
    })),
  }) : null, [session, scorePoints, snapshotsWithResult, correctCount, wrongCount]);
  const aiPrompt = session ? `Analise o resultado do meu simulado AWS usando o JSON exportado como fonte de verdade. Não invente dados ausentes. Revise cada questão errada, explique o gabarito e proponha um plano prático de estudo de 7 dias com revisão ativa e questões de acompanhamento. Considere o score e as explicações disponíveis.\n\nResumo: ${correctCount} acertos e ${wrongCount} erros em ${snapshotsWithResult.length} questões (${session.scorePercent}%). O histórico não contém tópico, confiança, marcações ou tempo por questão.` : "";

  function exportResult() {
    if (!exportPayload) return;
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `simulado-${session?.certificationCode ?? "resultado"}-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(aiPrompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch { setCopied(false); }
  }

  useEffect(() => {
    let cancelled = false;
    void fetchWeakServices({ take: 8, sample: 35 }).then((items) => {
      if (!cancelled) setHistoricalWeakServices(items);
    }).catch(() => { if (!cancelled) setHistoricalWeakServices([]); });
    return () => { cancelled = true; };
  }, []);

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

            </div>
          )}
        </PixelCard>

        {!loading && !error && session && (
          <>
          <PixelCard className="space-y-4">
            <div className="flex flex-wrap justify-end gap-2">
              <PixelButton variant="ghost" onClick={() => setNextStepsOpen(true)}>O que fazer agora?</PixelButton>
              <PixelButton onClick={exportResult}>Exportar resultado</PixelButton>
            </div>
            <div role="tablist" aria-label="Resultado do simulado" onKeyDown={(event) => {
              if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
              event.preventDefault();
              const tabs: ResultTab[] = ["score", "review", "gaps"];
              const next = (tabs.indexOf(resultTab) + (event.key === "ArrowRight" ? 1 : 2)) % 3;
              setResultTab(tabs[next]); tabRefs.current[next]?.focus();
            }} className="flex flex-wrap border-b border-[var(--pixel-border)]">
              {([["score", "Score"], ["review", "Revisão"], ["gaps", "Pontos fortes e fracos"]] as const).map(([tab, label], index) => <button key={tab} ref={(element) => { tabRefs.current[index] = element; }} id={`history-simulado-tab-${tab}`} type="button" role="tab" aria-selected={resultTab === tab} aria-controls={`history-simulado-panel-${tab}`} tabIndex={resultTab === tab ? 0 : -1} onClick={() => setResultTab(tab)} className={`border-b-2 px-4 py-3 font-mono text-[10px] uppercase ${resultTab === tab ? "border-[var(--pixel-primary)] text-[var(--pixel-primary)]" : "border-transparent text-[var(--pixel-subtext)]"}`}>{label}</button>)}
            </div>
            {resultTab === "score" && <div id="history-simulado-panel-score" role="tabpanel" aria-labelledby="history-simulado-tab-score" tabIndex={0}><SimuladoResultOverview overview={{ points: scorePoints, maxPoints: 1000, minimumCertificationPoints: 700, bestArea: null, weakestArea: null }} calculating={false} submitted loadingMotivationalMessage={false} motivationalMessage={null} /></div>}
            {resultTab === "gaps" && <div id="history-simulado-panel-gaps" role="tabpanel" aria-labelledby="history-simulado-tab-gaps" tabIndex={0} className="space-y-3">
              {historicalWeakServices.length ? historicalWeakServices.map((item) => <p key={`${item.serviceCode}-${item.topic}`} className="font-[var(--font-body)] text-sm">{item.topic}: {item.errors}/{item.attempts} erros ({item.errorRate}%)</p>) : <p className="font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">Ainda não há pontos fracos históricos disponíveis.</p>}
            </div>}
          </PixelCard>

          {resultTab === "review" && <div id="history-simulado-panel-review" role="tabpanel" aria-labelledby="history-simulado-tab-review" tabIndex={0} className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
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

              {selectedQuestion && removedFromDbByQuestion[selectedQuestion.questionId] && (
                <div className="border border-yellow-700 bg-yellow-900/20 px-4 py-3">
                  <p className="font-mono text-[10px] uppercase text-yellow-400">Questão removida</p>
                  <p className="mt-1 font-[var(--font-body)] text-sm text-yellow-200">
                    Esta questão foi removida do banco pelo administrador. Os dados exibidos abaixo vêm do snapshot
                    salvo no momento da realização do simulado.
                  </p>
                </div>
              )}

              {selectedQuestion && (
                <PixelCard className="space-y-3">
                  <QuestionReviewPanel
                    isCorrect={selectedQuestion.correct}
                    summary={selectedSummary}
                    loading={Boolean(loadingExplanationByQuestion[selectedQuestion.questionId])}
                    loadingText="Gerando revisao com IA para esta questao..."
                    options={selectedReviewOptions}
                    showExplanations={showExplanations}
                    questionStatement={selectedQuestion.statement}
                    questionTypeLabel={
                      selectedQuestion.questionType === "multi" ? "Tipo multipla escolha" : "Tipo escolha unica"
                    }
                    questionIndex={selectedIndex + 1}
                    questionCount={filteredSnapshots.length}
                  />

                  {failedExplanationByQuestion[selectedQuestion.questionId] &&
                    !loadingExplanationByQuestion[selectedQuestion.questionId] && (
                      <div className="flex items-center justify-between gap-3 border border-yellow-700/50 bg-yellow-900/10 px-3 py-2">
                        <p className="font-mono text-[10px] text-yellow-400">
                          Nao foi possivel gerar a explicacao automaticamente.
                        </p>
                        <button
                          type="button"
                          onClick={() => handleRetryExplanation(selectedQuestion.questionId)}
                          className="shrink-0 border border-[var(--pixel-primary)] px-3 py-1.5 font-mono text-[10px] uppercase text-[var(--pixel-primary)] hover:bg-[var(--pixel-primary)]/10"
                        >
                          Gerar Explicacao
                        </button>
                      </div>
                    )}

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
                      const isRemoved = removedFromDbByQuestion[item.questionId];
                      return (
                        <button
                          key={`${item.questionId}-${index}`}
                          type="button"
                          onClick={() => setSelectedQuestionId(item.questionId)}
                          title={isRemoved ? "Questão removida do banco" : undefined}
                          className={`border px-2 py-2 font-mono text-[10px] uppercase ${
                            isCurrent
                              ? "border-[var(--pixel-primary)] bg-[var(--pixel-primary)]/20"
                              : isRemoved
                                ? "border-yellow-700 bg-yellow-900/20"
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
          </div>}
          </>
        )}
      </main>
      {nextStepsOpen && <div role="dialog" aria-modal="true" aria-labelledby="history-next-title" className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/80 p-4">
        <PixelCard className="my-6 w-full max-w-2xl space-y-4">
          <div className="flex items-start justify-between gap-3"><div><p className="font-mono text-[10px] uppercase text-[var(--pixel-accent)]">Próximo passo</p><h2 id="history-next-title" className="font-[var(--font-body)] text-2xl">O que fazer agora?</h2></div><button type="button" aria-label="Fechar" onClick={() => setNextStepsOpen(false)} className="border-2 border-[var(--pixel-border)] px-3 py-1 font-mono">×</button></div>
          <p className="font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">Resultado: {correctCount} acertos e {wrongCount} erros. Anexe o JSON exportado ou cole seu conteúdo depois do prompt em qualquer IA.</p>
          <label htmlFor="history-ai-prompt" className="font-mono text-[10px] uppercase">Prompt para copiar</label>
          <textarea id="history-ai-prompt" readOnly value={aiPrompt} className="min-h-48 w-full resize-y border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] p-3 font-[var(--font-body)] text-sm text-[var(--pixel-text)]" />
          <div className="flex flex-wrap justify-end gap-2"><PixelButton variant="ghost" onClick={() => setNextStepsOpen(false)}>Fechar</PixelButton><PixelButton onClick={() => void copyPrompt()}>{copied ? "Prompt copiado" : "Copiar prompt"}</PixelButton></div>
        </PixelCard>
      </div>}
    </AppLayout>
  );
}
