"use client";

import { AnimatePresence, motion } from "framer-motion";
import { PixelButton } from "@/components/ui/pixel-button";
import { PixelCard } from "@/components/ui/pixel-card";
import { STUDY_OPTIONS } from "@/features/study";
import { QuestionReviewPanel } from "@/features/study/components/QuestionReviewPanel";
import { ReportQuestionModal } from "@/features/study/components/ReportQuestionModal";
import { SimuladoPreSubmitModal } from "@/features/study/components/simulado/SimuladoPreSubmitModal";
import { useSimuladoContext } from "@/features/study/context/SimuladoContext";
import { isAnswerCorrect, normalizeAnswerValue, normalizeCorrectOptions } from "@/features/study/services";
import { normalizeOptionText } from "@/lib/study-option-text";
import { QuestionOption } from "@/lib/types";

const OPTIONS: QuestionOption[] = STUDY_OPTIONS;
const GAP_TOP_N = 10;

function toggleMultiAnswer(current: QuestionOption[], option: QuestionOption): QuestionOption[] {
  if (current.includes(option)) return current.filter((item) => item !== option).sort();
  return [...current, option].sort();
}

export function SimuladoExamFlow() {
  const {
    questions,
    answers,
    currentIndex,
    submitted,
    inExamFlow,
    inReviewFlow,
    isActive,
    currentQuestion,
    answeredCount,
    timerLabel,
    focusMode,
    isPaused,
    session,
    markedForReview,
    allQuestionsAnswered,
    reportModalOpen,
    reportMessage,
    reportSubmitting,
    showPreSubmitSummary,
    currentReview,
    currentReviewOptions,
    loadingReviewByQuestion,
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

  return (
    <>
      {(inExamFlow || inReviewFlow) && currentQuestion && (
        <div className={`grid gap-4 ${focusMode ? "" : "xl:grid-cols-[minmax(0,1fr)_340px]"}`}>
          <section className="space-y-4">
            {inExamFlow && (
              <PixelCard
                className={`flex flex-wrap items-center justify-between gap-2 ${isPaused ? "border-yellow-500 bg-yellow-900/10" : "border-red-500 bg-red-900/10"}`}
              >
                <p className={`font-mono text-[10px] uppercase ${isPaused ? "text-yellow-300" : "text-red-300"}`}>
                  {isPaused ? "Simulado pausado · " : "Prova em andamento · "}Certificacao{" "}
                  {session?.certificationCode}
                </p>
                <div className="flex items-center gap-2">
                  {!focusMode && (
                    <div
                      className={`border-2 px-3 py-1 font-mono text-sm ${isPaused ? "border-yellow-400 text-yellow-300" : "border-red-400 text-red-300"}`}
                    >
                      {timerLabel}
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
              <PixelCard className="space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">
                    Questao {currentIndex + 1} de {questions.length}
                  </p>
                  <div className="flex items-center gap-2">
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
                  </div>
                </div>

                <p className={`font-[var(--font-body)] ${focusMode ? "text-lg" : "text-base"}`}>
                  {currentQuestion.statement}
                </p>
                {currentQuestion.questionType === "multi" && (
                  <p className="font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">
                    Questao multipla: selecione todas as alternativas corretas.
                  </p>
                )}

                <div className="grid gap-2">
                  {OPTIONS.map((option) => {
                    const text = normalizeOptionText(currentQuestion.options[option]);
                    if (!text) return null;
                    const isReviewing = submitted;
                    const selectedOptions = normalizeAnswerValue(answers[currentQuestion.id]);
                    const correctOptions = normalizeCorrectOptions(currentQuestion);
                    const isCorrectOption = isReviewing && correctOptions.includes(option);
                    const isSelectedWrong = isReviewing && selectedOptions.includes(option) && !isCorrectOption;
                    return (
                      <label
                        key={`${currentQuestion.id}-${option}`}
                        className={`flex items-start gap-2 border-2 px-3 py-2 ${
                          isCorrectOption
                            ? "border-[#2ecc71] bg-green-900/35"
                            : isSelectedWrong
                              ? "border-[#e74c3c] bg-red-900/35"
                              : "border-[var(--pixel-border)] bg-[var(--pixel-bg)]"
                        }`}
                      >
                        <input
                          type={currentQuestion.questionType === "multi" ? "checkbox" : "radio"}
                          name={currentQuestion.id}
                          checked={selectedOptions.includes(option)}
                          onChange={() => {
                            setAnswers((prev) => {
                              const current = normalizeAnswerValue(prev[currentQuestion.id]);
                              const nextValue =
                                currentQuestion.questionType === "multi"
                                  ? toggleMultiAnswer(current, option)
                                  : option;
                              return { ...prev, [currentQuestion.id]: nextValue };
                            });
                          }}
                          disabled={submitted}
                        />
                        <span className={`font-[var(--font-body)] ${focusMode ? "text-base" : "text-sm"}`}>
                          {option}) {text}
                        </span>
                      </label>
                    );
                  })}
                </div>

                {submitted && (
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
                      disabled={currentIndex === 0}
                    >
                      ← Anterior
                    </PixelButton>
                    <span className="font-mono text-[11px] text-[var(--pixel-subtext)]">
                      {currentIndex + 1} / {questions.length}
                    </span>
                    <PixelButton
                      onClick={() => void goToQuestion(currentIndex + 1)}
                      disabled={currentIndex === questions.length - 1}
                    >
                      Proxima →
                    </PixelButton>
                  </div>

                  {inExamFlow && (
                    <div className="h-1 w-full overflow-hidden rounded bg-[var(--pixel-border)]">
                      <div
                        className="h-full bg-[var(--pixel-accent)] transition-all duration-300"
                        style={{ width: `${questions.length > 0 ? (answeredCount / questions.length) * 100 : 0}%` }}
                      />
                    </div>
                  )}

                  {inReviewFlow && (
                    <div className="flex justify-end gap-2">
                      <PixelButton variant="ghost" onClick={navigateHome}>
                        Voltar ao inicio
                      </PixelButton>
                      <PixelButton onClick={handleReset}>Novo Simulado</PixelButton>
                    </div>
                  )}
                </div>
              </PixelCard>
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
                <PixelCard className="space-y-3">
                  <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Navegacao da prova</p>

                  <div className="space-y-1">
                    <div className="flex justify-between font-mono text-[10px] text-[var(--pixel-subtext)]">
                      <span>
                        Respondidas: {answeredCount}/{questions.length}
                      </span>
                      {inExamFlow && markedForReview.size > 0 && (
                        <span className="text-yellow-400">{markedForReview.size} p/ revisao</span>
                      )}
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
                  </div>

                  {inExamFlow && (
                    <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[9px] text-[var(--pixel-subtext)]">
                      <span className="flex items-center gap-1">
                        <span className="inline-block h-2 w-2 border border-[var(--pixel-accent)] bg-[var(--pixel-accent)]/30" />
                        Resp.
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="inline-block h-2 w-2 border border-yellow-400 bg-yellow-900/30" />
                        Revisar
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="inline-block h-2 w-2 border border-[var(--pixel-border)] bg-[var(--pixel-bg)]" />
                        Vazia
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-5 gap-1.5">
                    {questions.map((question, index) => {
                      const answered = normalizeAnswerValue(answers[question.id]).length > 0;
                      const isCurrent = index === currentIndex;
                      const isMarked = inExamFlow && markedForReview.has(question.id);
                      const isCorrectAfterSubmit =
                        submitted &&
                        isAnswerCorrect({
                          questionType: question.questionType,
                          answer: answers[question.id],
                          correctOption: question.correctOption,
                          correctOptions: question.correctOptions,
                        });
                      return (
                        <button
                          key={question.id}
                          type="button"
                          onClick={() => void goToQuestion(index)}
                          className={`border px-1 py-1.5 font-mono text-[10px] uppercase transition-colors ${
                            isCurrent
                              ? "border-[var(--pixel-primary)] bg-[var(--pixel-primary)]/20"
                              : submitted
                                ? isCorrectAfterSubmit
                                  ? "border-[#2ecc71] bg-green-900/15"
                                  : "border-[#e74c3c] bg-red-900/20"
                                : isMarked
                                  ? "border-yellow-400 bg-yellow-900/20"
                                  : answered
                                    ? "border-[var(--pixel-accent)] bg-[var(--pixel-accent)]/15"
                                    : "border-[var(--pixel-border)] bg-[var(--pixel-bg)]"
                          }`}
                        >
                          {index + 1}
                        </button>
                      );
                    })}
                  </div>

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
                </PixelCard>

                {inReviewFlow && (
                  <PixelCard className="space-y-3 border-[var(--pixel-accent)] bg-[var(--pixel-accent)]/10">
                    <p className="font-mono text-[10px] uppercase text-[var(--pixel-accent)]">
                      Prioridades de revisao
                    </p>
                    {loadingWeakServices && (
                      <p className="font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">
                        Atualizando pontos de fraqueza...
                      </p>
                    )}

                    {!loadingWeakServices && historicalWeakServices.length > 0 && (
                      <div className="space-y-2">
                        {historicalWeakServices.map((item) => (
                          <p
                            key={`history-${item.topic}`}
                            className="font-[var(--font-body)] text-xs text-[var(--pixel-text)]"
                          >
                            {item.topic}: {item.errors}/{item.attempts} erros ({item.errorRate}%)
                          </p>
                        ))}
                      </div>
                    )}

                    {!loadingWeakServices &&
                      historicalWeakServices.length === 0 &&
                      weakServicesCurrentExam.length > 0 && (
                        <div className="space-y-2">
                          {weakServicesCurrentExam.slice(0, GAP_TOP_N).map((item) => (
                            <p
                              key={`fallback-${item.topic}`}
                              className="font-[var(--font-body)] text-xs text-[var(--pixel-text)]"
                            >
                              {item.topic}: {item.errors}/{item.attempts} erros ({item.errorRate}%)
                            </p>
                          ))}
                        </div>
                      )}

                    {!loadingWeakServices && strongestGapTopics.length > 0 && (
                      <div className="space-y-3 border-t border-[var(--pixel-border)] pt-3">
                        <p className="font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">
                          Plano de acao sugerido com base nos gaps detectados.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <PixelButton onClick={navigateToKcGaps}>Fazer KC dos gaps</PixelButton>
                          <PixelButton variant="ghost" onClick={navigateToLabGaps}>
                            Criar Lab unico dos gaps
                          </PixelButton>
                        </div>
                      </div>
                    )}
                  </PixelCard>
                )}
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
