"use client";

import { ReactNode, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PixelButton } from "@/components/ui/pixel-button";
import { PixelCard } from "@/components/ui/pixel-card";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { AnswerConfidence, ConfidenceSelector } from "@/features/retention/components/ConfidenceSelector";
import { QuestionOptionsCard } from "@/features/study/components/QuestionOptionsCard";
import { QuestionReviewPanel } from "@/features/study/components/QuestionReviewPanel";
import { QuestionSideNav } from "@/features/study/components/QuestionSideNav";
import { SimuladoResultOverview } from "@/features/study/components/simulado/SimuladoResultOverview";
import { ReportQuestionModal } from "@/features/study/components/ReportQuestionModal";
import { SimuladoPreSubmitModal } from "@/features/study/components/simulado/SimuladoPreSubmitModal";
import { useSimuladoContext } from "@/features/study/context/SimuladoContext";
import { isAnswerCorrect, normalizeAnswerValue } from "@/features/study/services";
import { buildTopicPerformance, filterSimuladoReviewQuestions, getAverageQuestionTime } from "@/features/utils/funcs/simulado-utils";
import { GAP_TOP_N } from "@/types/questions";

export function SimuladoExamFlow() {
  const {
    questions,
    answers,
    currentIndex,
    submitted,
    reviewEachAnswer,
    inExamFlow,
    inReviewFlow,
    isActive,
    currentQuestion,
    answeredCount,
    timerLabel,
    focusMode,
    isPaused,
    session,
    certificationName,
    packName,
    packId,
    durationSeconds,
    markedForReview,
    confirmedAnswers,
    allQuestionsAnswered,
    confidenceByQuestion,
    reportModalOpen,
    reportMessage,
    reportSubmitting,
    showPreSubmitSummary,
    currentReview,
    currentReviewOptions,
    loadingReviewByQuestion,
    reviewByQuestion,
    timeSpentByQuestion,
    scoreOverview,
    calculating,
    loadingMotivationalMessage,
    motivationalMessage,
    historicalWeakServices,
    loadingWeakServices,
    weakServicesCurrentExam,
    strongestGapTopics,
    setAnswers,
    setFocusMode,
    setReportModalOpen,
    setShowPreSubmitSummary,
    goToQuestion,
    toggleMarkForReview,
    confirmAnswer,
    setConfidenceForQuestion,
    handleForceExit,
    handleReset,
    handleSubmitExam,
    submitQuestionReport,
    resumeSession,
    pauseSession,
    navigateHome,
    navigateToKcGaps,
    navigateToLabGaps,
  } = useSimuladoContext();

  // Non-blocking confidence prompt: opens on hover/click of the advance button, only when
  // the current question has an answer and hasn't been rated yet, so it never interrupts
  // someone still reading/thinking (user request: no inline step, no extra screen).
  const [confidencePromptOpen, setConfidencePromptOpen] = useState(false);
  const [resultTab, setResultTab] = useState<"score" | "review" | "gaps">("score");
  const resultTabIndex = (["score", "review", "gaps"] as const).indexOf(resultTab);
  const [resultFilter, setResultFilter] = useState<"all" | "correct" | "wrong">("all");
  const [topicFilter, setTopicFilter] = useState("all");
  const [timeFilter, setTimeFilter] = useState<"all" | "fast" | "slow">("all");
  const [markedOnly, setMarkedOnly] = useState(false);
  const [confidenceFilter, setConfidenceFilter] = useState<"all" | "false-belief" | "lucky-guess">("all");
  const [expandedReviews, setExpandedReviews] = useState<Set<string>>(new Set());
  const [nextStepsOpen, setNextStepsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const topicPerformance = useMemo(() => buildTopicPerformance(questions, answers), [questions, answers]);
  const averageQuestionTime = useMemo(() => getAverageQuestionTime(questions, timeSpentByQuestion), [questions, timeSpentByQuestion]);
  const filteredQuestions = useMemo(() => filterSimuladoReviewQuestions(questions, answers, timeSpentByQuestion, markedForReview, confidenceByQuestion, { result: resultFilter, topic: topicFilter, time: timeFilter, markedOnly, confidence: confidenceFilter }), [answers, questions, resultFilter, timeFilter, timeSpentByQuestion, topicFilter, markedForReview, confidenceByQuestion, markedOnly, confidenceFilter]);
  const correctCount = useMemo(() => questions.filter((question) => isAnswerCorrect({ questionType: question.questionType, answer: answers[question.id], correctOption: question.correctOption, correctOptions: question.correctOptions })).length, [answers, questions]);
  const timerModeColors = session?.timerMode === "COUNTUP_FREE"
    ? { card: "border-blue-500 bg-blue-900/10", label: "text-blue-300", box: "border-blue-400 text-blue-300" }
    : session?.timerMode === "NONE"
      ? { card: "border-slate-500 bg-slate-900/10", label: "text-slate-300", box: "border-slate-400 text-slate-300" }
      : { card: "border-red-500 bg-red-900/10", label: "text-red-300", box: "border-red-400 text-red-300" };
  const exportPayload = useMemo(() => ({
    metadata: {
      certificationCode: session?.certificationCode ?? null,
      certificationName,
      packId,
      packName,
      startedAt: session?.startedAt ?? null,
      completedAt: session ? new Date(new Date(session.startedAt).getTime() + durationSeconds * 1000).toISOString() : null,
      durationSeconds,
      examStyle: session?.examStyle ?? null,
      timerMode: session?.timerMode ?? null,
    },
    score: {
      points: scoreOverview?.points ?? 0,
      maxPoints: scoreOverview?.maxPoints ?? 1000,
      minimumCertificationPoints: scoreOverview?.minimumCertificationPoints ?? 700,
      passed: (scoreOverview?.points ?? 0) >= (scoreOverview?.minimumCertificationPoints ?? 700),
    },
    performanceByTopic: topicPerformance,
    bestArea: scoreOverview?.bestArea ?? null,
    weakestArea: scoreOverview?.weakestArea ?? null,
    metrics: { totalQuestions: questions.length, correctAnswers: correctCount, wrongAnswers: questions.length - correctCount },
    questions: questions.map((question) => ({
      questionId: question.id,
      statement: question.statement,
      topic: question.topic?.trim() || "OUTROS",
      questionType: question.questionType,
      options: question.options,
      correctOptions: question.correctOptions,
      userAnswer: normalizeAnswerValue(answers[question.id]),
      isCorrect: isAnswerCorrect({ questionType: question.questionType, answer: answers[question.id], correctOption: question.correctOption, correctOptions: question.correctOptions }),
      timeSpentSeconds: timeSpentByQuestion[question.id] ?? 0,
      markedForReview: markedForReview.has(question.id),
      confidence: confidenceByQuestion[question.id] ?? null,
      explanationSummary: reviewByQuestion[question.id]?.summary ?? null,
      explanations: { ...question.explanations, ...reviewByQuestion[question.id]?.options },
    })),
  }), [session, certificationName, packName, packId, durationSeconds, scoreOverview, topicPerformance, questions, correctCount, answers, timeSpentByQuestion, markedForReview, confidenceByQuestion, reviewByQuestion]);
  const aiPrompt = `Analise o resultado do meu simulado AWS usando o JSON exportado que vou anexar ou colar depois deste prompt como fonte de verdade. Não invente dados e não ignore questões sem resposta.\n\nRevise cada questão errada, explique por que a resposta correta está certa e por que minha resposta falhou. Identifique padrões por tópico, priorize os pontos fracos (incluindo erros com alta confiança), destaque lacunas e acertos frágeis, e proponha um plano de estudo prático de 7 dias com objetivos diários, revisão ativa e questões de acompanhamento. Considere o score, o tempo por questão e as explicações incluídas.\n\nResumo: ${correctCount} acertos e ${questions.length - correctCount} erros em ${questions.length} questões. Área mais fraca: ${scoreOverview?.weakestArea?.topic ?? "sem dados"}.`;

  function exportResult() {
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `simulado-${session?.certificationCode ?? "resultado"}-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setNextStepsOpen(true);
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(aiPrompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }
  const needsConfidencePrompt =
    inExamFlow &&
    !reviewEachAnswer &&
    !!currentQuestion &&
    normalizeAnswerValue(answers[currentQuestion.id]).length > 0 &&
    !confidenceByQuestion[currentQuestion.id];

  function openConfidencePromptIfNeeded() {
    if (needsConfidencePrompt) setConfidencePromptOpen(true);
  }

  function advance(action: () => void) {
    // First click (or hover) surfaces the prompt; clicking again while it's already open
    // skips the rating and advances anyway, so it never traps the user.
    if (needsConfidencePrompt && !confidencePromptOpen) {
      setConfidencePromptOpen(true);
      return;
    }
    setConfidencePromptOpen(false);
    action();
  }

  function pickConfidenceAndAdvance(confidence: AnswerConfidence, action: () => void) {
    if (currentQuestion) setConfidenceForQuestion(currentQuestion.id, confidence);
    setConfidencePromptOpen(false);
    action();
  }

  return (
    <>
      {inReviewFlow && scoreOverview && (
        <PixelCard className="space-y-4">
          <div className="flex flex-wrap justify-end gap-2">
            <PixelButton variant="ghost" onClick={() => setNextStepsOpen(true)}>O que fazer agora?</PixelButton>
            <PixelButton onClick={exportResult}>Exportar resultado</PixelButton>
          </div>
          <div role="tablist" aria-label="Resultado do simulado" onKeyDown={(event) => { if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return; event.preventDefault(); const next = (resultTabIndex + (event.key === "ArrowRight" ? 1 : 2)) % 3; setResultTab((["score", "review", "gaps"] as const)[next]); tabRefs.current[next]?.focus(); }} className="flex flex-wrap border-b border-[var(--pixel-border)]">
            {([ ["score", "Score"], ["review", "Revisão"], ["gaps", "Pontos fortes e fracos"] ] as const).map(([tab, label]) => (
              <button key={tab} ref={(element) => { tabRefs.current[["score", "review", "gaps"].indexOf(tab)] = element; }} id={`simulado-tab-${tab}`} type="button" role="tab" aria-selected={resultTab === tab} aria-controls={`simulado-panel-${tab}`} tabIndex={resultTab === tab ? 0 : -1} onClick={() => setResultTab(tab)}
                className={`border-b-2 px-4 py-3 font-mono text-[10px] uppercase ${resultTab === tab ? "border-[var(--pixel-primary)] text-[var(--pixel-primary)]" : "border-transparent text-[var(--pixel-subtext)]"}`}>
                {label}
              </button>
            ))}
          </div>
          {resultTab === "score" && <div id="simulado-panel-score" role="tabpanel" aria-labelledby="simulado-tab-score" tabIndex={0}><SimuladoResultOverview overview={scoreOverview} calculating={calculating} submitted loadingMotivationalMessage={loadingMotivationalMessage} motivationalMessage={motivationalMessage} /></div>}
          {resultTab === "review" && <div id="simulado-panel-review" role="tabpanel" aria-labelledby="simulado-tab-review" tabIndex={0} className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <select aria-label="Filtrar por resultado" value={resultFilter} onChange={(event) => setResultFilter(event.target.value as typeof resultFilter)} className="border border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2 font-mono text-xs">
                <option value="all">Todas</option><option value="correct">Certas</option><option value="wrong">Erradas</option>
              </select>
              <select aria-label="Filtrar por área" value={topicFilter} onChange={(event) => setTopicFilter(event.target.value)} className="border border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2 font-mono text-xs">
                <option value="all">Todas as áreas</option>{topicPerformance.map((topic) => <option key={topic.topic} value={topic.topic}>{topic.topic}</option>)}
              </select>
              <select aria-label="Filtrar por tempo" value={timeFilter} onChange={(event) => setTimeFilter(event.target.value as typeof timeFilter)} className="border border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2 font-mono text-xs">
                <option value="all">Qualquer tempo</option><option value="fast">Rápidas (&lt; 50% da média)</option><option value="slow">Demoradas (&gt; 150% da média)</option>
              </select>
              <select aria-label="Filtrar por confiança" value={confidenceFilter} onChange={(event) => setConfidenceFilter(event.target.value as typeof confidenceFilter)} className="border border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2 font-mono text-xs">
                <option value="all">Todas as confianças</option><option value="false-belief">Alta confiança + errou</option><option value="lucky-guess">Baixa confiança + acertou</option>
              </select>
              <label className="flex items-center gap-2 border border-[var(--pixel-border)] px-3 py-2 font-mono text-xs"><input type="checkbox" checked={markedOnly} onChange={(event) => setMarkedOnly(event.target.checked)} />Marcadas para revisão</label>
            </div>
            <p aria-live="polite" className="sr-only">{filteredQuestions.length} de {questions.length} questões</p>
            <p className="font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">Média: {Math.round(averageQuestionTime)}s por questão. Limites relativos de 50% e 150% destacam extremos sem depender da duração do simulado.</p>
            {filteredQuestions.map((question) => {
              const index = questions.findIndex((item) => item.id === question.id);
              const correct = isAnswerCorrect({ questionType: question.questionType, answer: answers[question.id], correctOption: question.correctOption, correctOptions: question.correctOptions });
              const selected = normalizeAnswerValue(answers[question.id]);
              const review = reviewByQuestion[question.id];
              const options = (["A", "B", "C", "D", "E"] as const).flatMap((option) => question.options[option] ? [{ option, text: question.options[option], explanation: review?.options[option] ?? question.explanations[option] ?? "Sem explicacao adicional.", isCorrect: question.correctOptions.includes(option), isSelected: selected.includes(option) }] : []);
              const expanded = expandedReviews.has(question.id);
              return <div key={question.id} className="border border-[var(--pixel-border)] bg-[var(--pixel-bg)]">
                <button type="button" aria-expanded={expanded} onClick={() => { setExpandedReviews((previous) => { const next = new Set(previous); if (expanded) next.delete(question.id); else next.add(question.id); return next; }); void goToQuestion(index); }} className="flex w-full flex-wrap items-center justify-between gap-2 px-3 py-3 text-left">
                  <span className="font-mono text-xs">Questão {index + 1} · {correct ? "Certa" : "Errada"} · {question.topic || "OUTROS"}</span><span className="font-mono text-[10px] text-[var(--pixel-subtext)]">{timeSpentByQuestion[question.id] ?? 0}s · {expanded ? "−" : "+"}</span>
                </button>
                {expanded && <div className="p-3"><QuestionReviewPanel isCorrect={correct} summary={review?.summary} loading={Boolean(loadingReviewByQuestion[question.id])} loadingText="Gerando revisão com IA..." options={options} questionStatement={question.statement} questionTypeLabel={question.questionType === "multi" ? "Tipo múltipla escolha" : "Tipo escolha única"} questionIndex={index + 1} questionCount={questions.length} /></div>}
              </div>;
            })}
            {filteredQuestions.length === 0 && <p className="font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">Nenhuma questão corresponde aos filtros.</p>}
            <div className="flex justify-end gap-2"><PixelButton variant="ghost" onClick={navigateHome}>Voltar ao início</PixelButton><PixelButton onClick={handleReset}>Novo Simulado</PixelButton></div>
          </div>}
          {resultTab === "gaps" && <div id="simulado-panel-gaps" role="tabpanel" aria-labelledby="simulado-tab-gaps" tabIndex={0} className="space-y-4">
            {loadingWeakServices && <p className="font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">Atualizando pontos de fraqueza...</p>}
            {(historicalWeakServices.length ? historicalWeakServices : weakServicesCurrentExam).slice(0, GAP_TOP_N).map((item) => <p key={item.topic} className="font-[var(--font-body)] text-sm">{item.topic}: {item.errors}/{item.attempts} erros ({item.errorRate}%)</p>)}
            {strongestGapTopics.length > 0 && <div className="flex flex-wrap gap-2 border-t border-[var(--pixel-border)] pt-3"><PixelButton onClick={navigateToKcGaps}>Fazer KC dos gaps</PixelButton><PixelButton variant="ghost" onClick={navigateToLabGaps}>Criar Lab único dos gaps</PixelButton></div>}
            <div className="flex justify-end gap-2"><PixelButton variant="ghost" onClick={navigateHome}>Voltar ao início</PixelButton><PixelButton onClick={handleReset}>Novo Simulado</PixelButton></div>
          </div>}
        </PixelCard>
      )}
      {nextStepsOpen && <div role="dialog" aria-modal="true" aria-labelledby="simulado-next-title" className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/80 p-4">
        <PixelCard className="my-6 w-full max-w-2xl space-y-4">
          <div className="flex items-start justify-between gap-3"><div><p className="font-mono text-[10px] uppercase text-[var(--pixel-accent)]">Próximo passo</p><h2 id="simulado-next-title" className="font-[var(--font-body)] text-2xl">O que fazer agora?</h2></div><button type="button" aria-label="Fechar" onClick={() => setNextStepsOpen(false)} className="border-2 border-[var(--pixel-border)] px-3 py-1 font-mono">×</button></div>
          <p className="font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">Exportamos {questions.length} questões, com {questions.length - correctCount} erros. Área mais fraca: {scoreOverview?.weakestArea?.topic ?? "sem dados"}. Anexe o JSON baixado ou cole o conteúdo depois do prompt em qualquer IA.</p>
          <label htmlFor="simulado-ai-prompt" className="font-mono text-[10px] uppercase">Prompt para copiar</label>
          <textarea id="simulado-ai-prompt" readOnly value={aiPrompt} className="min-h-48 w-full resize-y border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] p-3 font-[var(--font-body)] text-sm text-[var(--pixel-text)]" />
          <div className="flex flex-wrap justify-end gap-2"><PixelButton variant="ghost" onClick={() => setNextStepsOpen(false)}>Fechar</PixelButton><PixelButton onClick={() => void copyPrompt()}>{copied ? "Prompt copiado" : "Copiar prompt"}</PixelButton></div>
        </PixelCard>
      </div>}

      {inExamFlow && currentQuestion && (
        <div className={`grid gap-4 ${focusMode ? "" : "xl:grid-cols-[minmax(0,1fr)_340px]"}`}>
          <section className="space-y-4">
            {inExamFlow && (
              <PixelCard
                className={`flex flex-wrap items-center justify-between gap-2 ${isPaused ? "border-yellow-500 bg-yellow-900/10" : timerModeColors.card}`}
              >
                <p className={`font-mono text-[10px] uppercase ${isPaused ? "text-yellow-300" : timerModeColors.label}`}>
                  {isPaused ? "Simulado pausado · " : "Prova em andamento · "}Certificacao{" "}
                  {session?.certificationCode}
                </p>
                <div className="flex items-center gap-2">
                  {!focusMode && (
                    <div
                      className={`border-2 px-3 py-1 font-mono text-sm ${isPaused ? "border-yellow-400 text-yellow-300" : timerModeColors.box}`}
                    >
                      {session?.timerMode === "COUNTUP_FREE" ? `Tempo decorrido · ${timerLabel}` : session?.timerMode === "NONE" ? "Sem cronometro" : timerLabel}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => (isPaused ? resumeSession() : pauseSession())}
                    title={isPaused ? "Retomar simulado" : "Pausar simulado"}
                    className={`flex items-center gap-1 border px-2 py-1 font-mono text-[10px] uppercase transition-colors ${
                      isPaused
                        ? "border-yellow-400 bg-yellow-900/30 text-yellow-300 hover:bg-yellow-900/50"
                        : "border-[var(--pixel-border)] text-[var(--pixel-subtext)] hover:border-yellow-500 hover:text-yellow-400"
                    }`}
                  >
                    {isPaused ? (
                      <>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                          <polygon points="5,3 19,12 5,21" />
                        </svg>
                        Retomar
                      </>
                    ) : (
                      <>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                          <rect x="6" y="4" width="4" height="16" />
                          <rect x="14" y="4" width="4" height="16" />
                        </svg>
                        Pausar
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFocusMode((prev) => !prev)}
                    title={focusMode ? "Sair do Modo Foco" : "Ativar Modo Foco"}
                    className={`flex items-center gap-1 border px-2 py-1 font-mono text-[10px] uppercase transition-colors ${
                      focusMode
                        ? "border-[var(--pixel-primary)] bg-[var(--pixel-primary)]/20 text-[var(--pixel-primary)]"
                        : "border-[var(--pixel-border)] text-[var(--pixel-subtext)] hover:text-[var(--pixel-text)]"
                    }`}
                  >
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <circle cx="12" cy="12" r="3" />
                      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M17.66 6.34l-2.12 2.12M6.34 17.66l-2.12 2.12" />
                    </svg>
                    Foco
                  </button>
                </div>
              </PixelCard>
            )}

            <motion.div
              key={currentQuestion.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              <QuestionOptionsCard
                question={currentQuestion}
                answer={answers[currentQuestion.id]}
                onSelect={(value) => {
                  setAnswers((prev) => ({ ...prev, [currentQuestion.id]: value }));
                }}
                submitted={submitted || (reviewEachAnswer && confirmedAnswers.has(currentQuestion.id))}
                large={focusMode}
                questionLabel={`Questao ${currentIndex + 1} de ${questions.length}`}
                headerActions={
                  <>
                    {inExamFlow && (
                      <button
                        type="button"
                        onClick={() => toggleMarkForReview(currentQuestion.id)}
                        title={
                          markedForReview.has(currentQuestion.id)
                            ? "Remover marcacao de revisao"
                            : "Marcar para revisao"
                        }
                        className={`flex items-center gap-1 border px-2 py-0.5 font-mono text-[10px] uppercase transition-colors ${
                          markedForReview.has(currentQuestion.id)
                            ? "border-yellow-400 bg-yellow-900/30 text-yellow-300"
                            : "border-[var(--pixel-border)] text-[var(--pixel-subtext)] hover:border-yellow-500 hover:text-yellow-400"
                        }`}
                      >
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill={markedForReview.has(currentQuestion.id) ? "currentColor" : "none"}
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                        </svg>
                        Revisar
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setReportModalOpen(true)}
                      title="Denunciar questao"
                      className="border border-[var(--pixel-border)] p-1 text-[var(--pixel-subtext)] transition-colors hover:border-yellow-500 hover:text-yellow-400"
                    >
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                    </button>
                  </>
                }
                footer={
                  <>
                    {(submitted || (reviewEachAnswer && confirmedAnswers.has(currentQuestion.id))) && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <QuestionReviewPanel
                          isCorrect={isAnswerCorrect({
                            questionType: currentQuestion.questionType,
                            answer: answers[currentQuestion.id],
                            correctOption: currentQuestion.correctOption,
                            correctOptions: currentQuestion.correctOptions,
                          })}
                          summary={currentReview?.summary}
                          loading={Boolean(loadingReviewByQuestion[currentQuestion.id])}
                          loadingText="Gerando revisao com IA..."
                          options={currentReviewOptions}
                          questionStatement={currentQuestion.statement}
                          questionTypeLabel={
                            currentQuestion.questionType === "multi" ? "Tipo multipla escolha" : "Tipo escolha unica"
                          }
                          questionIndex={currentIndex + 1}
                          questionCount={questions.length}
                        />
                      </motion.div>
                    )}

                    <AnimatePresence>
                      {reportMessage && (
                        <motion.p
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="font-[var(--font-body)] text-xs text-[var(--pixel-accent)]"
                        >
                          {reportMessage}
                        </motion.p>
                      )}
                    </AnimatePresence>

                    <div className="space-y-2 border-t border-[var(--pixel-border)] pt-3">
                      <div className="flex items-center justify-between gap-2">
                        <PixelButton
                          variant="ghost"
                          onClick={() => void goToQuestion(currentIndex - 1)}
                          disabled={reviewEachAnswer || currentIndex === 0}
                        >
                          ← Anterior
                        </PixelButton>
                        <span className="font-mono text-[11px] text-[var(--pixel-subtext)]">
                          {currentIndex + 1} / {questions.length}
                        </span>
                        <ConfidenceGate
                          open={confidencePromptOpen}
                          onOpenChange={setConfidencePromptOpen}
                          onPick={(confidence) =>
                            pickConfidenceAndAdvance(confidence, () => void goToQuestion(currentIndex + 1))
                          }
                        >
                          <PixelButton
                            onClick={() => {
                              if (reviewEachAnswer && !submitted && currentQuestion) {
                                confirmAnswer(currentQuestion.id);
                                void goToQuestion(currentIndex);
                                return;
                              }
                              advance(() => void goToQuestion(currentIndex + 1));
                            }}
                            onMouseEnter={openConfidencePromptIfNeeded}
                            disabled={reviewEachAnswer ? (!normalizeAnswerValue(answers[currentQuestion.id]).length || (submitted && currentIndex === questions.length - 1)) : currentIndex === questions.length - 1}
                          >
                            {reviewEachAnswer && !submitted && !confirmedAnswers.has(currentQuestion.id) ? "Conferir resposta" : "Proxima →"}
                          </PixelButton>
                        </ConfidenceGate>
                      </div>

                      {inExamFlow && (
                        <div className="h-1 w-full overflow-hidden rounded bg-[var(--pixel-border)]">
                          <div
                            className="h-full bg-[var(--pixel-accent)] transition-all duration-300"
                            style={{
                              width: `${questions.length > 0 ? (answeredCount / questions.length) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      )}

                      {/* Focus mode hides the sidebar (and its "Enviar Simulado" button), so without this
                          the only way to finish is to exit focus mode first — mirror it here. */}
                      {inExamFlow && focusMode && (
                        <div className="flex items-center justify-between gap-2">
                          <PixelButton variant="ghost" onClick={handleForceExit} className="justify-center">
                            Encerrar
                          </PixelButton>
                          <PixelButton
                            onClick={() => setShowPreSubmitSummary(true)}
                            disabled={!allQuestionsAnswered}
                            className="justify-center"
                          >
                            Enviar Simulado
                          </PixelButton>
                        </div>
                      )}
                    </div>
                  </>
                }
              />
            </motion.div>
          </section>

          <AnimatePresence>
            {!focusMode && (
              <motion.aside
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="space-y-4 xl:sticky xl:top-24 xl:self-start"
              >
                <QuestionSideNav
                  questions={questions}
                  answers={answers}
                  currentIndex={currentIndex}
                  submitted={submitted}
                  markedForReview={markedForReview}
                  onGoToQuestion={(index) => void goToQuestion(index)}
                  title="Navegacao da prova"
                >
                  {inExamFlow && (
                    <div className="flex flex-col gap-2 border-t border-[var(--pixel-border)] pt-3">
                      <PixelButton
                        onClick={() => setShowPreSubmitSummary(true)}
                        disabled={!allQuestionsAnswered}
                        className="w-full justify-center"
                      >
                        Enviar Simulado
                      </PixelButton>
                      <PixelButton
                        variant="ghost"
                        onClick={handleForceExit}
                        className="w-full justify-center text-center"
                      >
                        Encerrar
                      </PixelButton>
                    </div>
                  )}
                </QuestionSideNav>
              </motion.aside>
            )}
          </AnimatePresence>
        </div>
      )}

      {!isActive && questions.length > 0 && !submitted && (
        <PixelCard className="border-yellow-500 bg-yellow-900/20">
          <p className="font-[var(--font-body)] text-sm text-yellow-300">
            O tempo do simulado terminou ou a sessao foi encerrada. Envie ou reinicie para continuar.
          </p>
        </PixelCard>
      )}

      <SimuladoPreSubmitModal
        open={showPreSubmitSummary}
        questions={questions}
        answeredCount={answeredCount}
        markedForReview={markedForReview}
        onGoToQuestion={(i) => {
          setShowPreSubmitSummary(false);
          void goToQuestion(i);
        }}
        onCancel={() => setShowPreSubmitSummary(false)}
        onConfirm={() => void handleSubmitExam()}
      />

      {currentQuestion && (
        <ReportQuestionModal
          open={reportModalOpen}
          questionStatement={currentQuestion.statement}
          submitting={reportSubmitting}
          onClose={() => setReportModalOpen(false)}
          onSubmit={submitQuestionReport}
        />
      )}

      {isPaused && inExamFlow && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4" role="dialog" aria-modal="true">
          <PixelCard className="w-full max-w-sm space-y-5 border-yellow-500 bg-yellow-900/20 text-center">
            <div>
              <p className="font-mono text-[10px] uppercase text-yellow-300">Simulado Pausado</p>
              <p className="mt-2 font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
                Tempo restante: <span className="font-mono text-yellow-300">{timerLabel}</span>
              </p>
              <p className="mt-1 font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">
                Questao {currentIndex + 1} de {questions.length} · {answeredCount} respondidas
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <PixelButton onClick={resumeSession} className="w-full justify-center">
                Retomar Simulado
              </PixelButton>
              <PixelButton variant="ghost" onClick={handleForceExit} className="w-full justify-center">
                Encerrar e sair
              </PixelButton>
            </div>
          </PixelCard>
        </div>
      )}
    </>
  );
}

/** Wraps a Proxima/Enviar trigger so clicking (or hovering) it surfaces a quick,
 * non-blocking confidence prompt instead of the inline post-answer step used in KC. */
function ConfidenceGate({
  open,
  onOpenChange,
  onPick,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (confidence: AnswerConfidence) => void;
  children: ReactNode;
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor asChild>{children}</PopoverAnchor>
      <PopoverContent
        side="top"
        className="w-auto border-2 border-[var(--pixel-border)] bg-[var(--pixel-card)] p-3 shadow-[4px_4px_0_0_var(--pixel-shadow)]"
      >
        <ConfidenceSelector onSelect={onPick} />
      </PopoverContent>
    </Popover>
  );
}
