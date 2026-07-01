"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { PixelCard } from "@/components/ui/pixel-card";
import { useUserProfile } from "@/hooks/useUserProfile";
import { StudyAnswerMap, StudyExplanationResult } from "@/features/study";
import { KCSetupPanel } from "@/features/study/components/kc/KCSetupPanel";
import { KCQuestionFlow } from "@/features/study/components/kc/KCQuestionFlow";
import { KCSummaryCard } from "@/features/study/components/kc/KCSummaryCard";
import {
  createKcQuestions,
  createStudyExplanation,
  fetchWeakServices,
  isAnswerCorrect,
  listStudyServices,
  normalizeAnswerValue,
  normalizeCorrectOptions,
  pollKcGenerationStatus,
  reportStudyQuestion,
  saveStudyHistory,
  suggestStudyQuestion,
  StudyServiceItem,
  WeakServiceItem,
} from "@/features/study/services";
import { AnswerConfidence } from "@/features/retention/components/ConfidenceSelector";
import { useProgressNotifications } from "@/features/study/components/notifications/useProgressNotifications";
import { getTaskXpByDifficulty } from "@/lib/levels";
import { normalizeOptionText } from "@/lib/study-option-text";
import { QuestionOption, StudyQuestion } from "@/lib/types";
import { STUDY_OPTIONS } from "@/features/study/constants";

const OPTIONS: QuestionOption[] = STUDY_OPTIONS;
const SERVICES_PAGE_SIZE = 12;
const GENERATION_POLL_INTERVAL_MS = 4_000;
const GENERATION_TIMEOUT_MS = 90_000;

function maxTopicsForCount(count: number): number {
  return Math.max(1, Math.floor(count / 5));
}

export function KCScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshTotalXp } = useUserProfile();
  const notifyProgress = useProgressNotifications();

  // Services
  const [services, setServices] = useState<StudyServiceItem[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [servicesError, setServicesError] = useState<string | null>(null);

  // Wizard state (Issue #16)
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState(10);
  const [searchTopic, setSearchTopic] = useState("");
  const [servicesPage, setServicesPage] = useState(1);
  const [suggestionSent, setSuggestionSent] = useState<string | null>(null);

  // On-demand generation state (Issue #18)
  const [generatingQuestions, setGeneratingQuestions] = useState(false);
  const [generationTimedOut, setGenerationTimedOut] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const generationDeadlineRef = useRef<number | null>(null);

  // Flow state
  const [questions, setQuestions] = useState<StudyQuestion[]>([]);
  const [answers, setAnswers] = useState<StudyAnswerMap>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [submittedCurrent, setSubmittedCurrent] = useState(false);
  const [completionMessage, setCompletionMessage] = useState<string | null>(null);
  const [explanationByQuestion, setExplanationByQuestion] = useState<Record<string, StudyExplanationResult>>({});
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [loadingExplanation, setLoadingExplanation] = useState(false);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [lastEarnedXp, setLastEarnedXp] = useState<number | null>(null);
  const [flowError, setFlowError] = useState<string | null>(null);
  const [kcSummary, setKcSummary] = useState<{
    correct: number;
    total: number;
    scorePercent: number;
    gainedXp: number;
    historySaved: boolean;
  } | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportMessage, setReportMessage] = useState<string | null>(null);

  // Per-question confidence captured via ConfidenceSelector (RF-09, ADR-05).
  const [confidenceByQuestion, setConfidenceByQuestion] = useState<Record<string, AnswerConfidence>>({});

  // Gaps state
  const [weakServices, setWeakServices] = useState<WeakServiceItem[]>([]);
  const [loadingWeakServices, setLoadingWeakServices] = useState(false);

  useEffect(() => {
    setServicesLoading(true);
    // Difficulty is gap-based; load services without a fixed difficulty filter.
    listStudyServices({ withCount: true })
      .then((items) => setServices(items))
      .catch((error) => setServicesError(error instanceof Error ? error.message : "Falha ao carregar serviços AWS."))
      .finally(() => setServicesLoading(false));
  }, []);

  useEffect(() => {
    if (questions.length > 0) return;
    setLoadingWeakServices(true);
    fetchWeakServices({ take: 8, sample: 35 })
      .then((items) => setWeakServices(items))
      .catch(() => setWeakServices([]))
      .finally(() => setLoadingWeakServices(false));
  }, [questions.length]);

  // Pre-select topics from query string (e.g., deep-link from jornada).
  useEffect(() => {
    const topicsRaw = searchParams.get("topics");
    if (!topicsRaw || services.length === 0) return;
    const requested = topicsRaw.split(",").map((item) => item.trim().toUpperCase()).filter(Boolean);
    if (requested.length === 0) return;
    const maxTopics = maxTopicsForCount(questionCount);
    const availableCodes = new Set(services.map((s) => s.code.toUpperCase()));
    const preselected = Array.from(new Set(requested)).filter((c) => availableCodes.has(c)).slice(0, maxTopics);
    if (preselected.length > 0) {
      setSelectedTopics(preselected);
      setActiveStep(3); // jump to summary when topics are pre-selected via URL
    }
  }, [searchParams, services, questionCount]);

  // Cleanup polling on unmount.
  useEffect(() => {
    return () => {
      if (pollTimerRef.current !== null) clearInterval(pollTimerRef.current);
    };
  }, []);

  const inProgress = questions.length > 0;
  const currentQuestion = questions[currentIndex] ?? null;
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : undefined;

  const filteredServices = useMemo(() => {
    const term = searchTopic.trim().toLowerCase();
    if (!term) return services;
    return services.filter((s) => `${s.name} ${s.code} ${s.description ?? ""}`.toLowerCase().includes(term));
  }, [searchTopic, services]);

  const servicePageCount = Math.max(1, Math.ceil(filteredServices.length / SERVICES_PAGE_SIZE));
  const currentServicesPage = Math.max(1, Math.min(servicesPage, servicePageCount));
  const pagedServices = filteredServices.slice(
    (currentServicesPage - 1) * SERVICES_PAGE_SIZE,
    currentServicesPage * SERVICES_PAGE_SIZE,
  );

  const stats = useMemo(() => {
    const answered = questions.filter((q) => normalizeAnswerValue(answers[q.id]).length > 0).length;
    const correct = questions.filter((q) =>
      answers[q.id] && isAnswerCorrect({ questionType: q.questionType, answer: answers[q.id], correctOption: q.correctOption, correctOptions: q.correctOptions }),
    ).length;
    return { answered, total: questions.length, correct, wrong: Math.max(0, answered - correct) };
  }, [answers, questions]);

  const isCurrentCorrect = Boolean(
    currentQuestion &&
    isAnswerCorrect({
      questionType: currentQuestion.questionType,
      answer: currentAnswer,
      correctOption: currentQuestion.correctOption,
      correctOptions: currentQuestion.correctOptions,
    }),
  );

  const currentExplanation = currentQuestion ? explanationByQuestion[currentQuestion.id] : undefined;
  const currentReviewOptions = useMemo(() => {
    if (!currentQuestion) return [];
    const selectedOptions = normalizeAnswerValue(answers[currentQuestion.id]);
    const correctOptions = normalizeCorrectOptions(currentQuestion);
    return OPTIONS.map((option) => {
      const text = normalizeOptionText(currentQuestion.options[option]);
      if (!text) return null;
      return {
        option,
        text,
        explanation: currentExplanation?.options[option] ?? currentQuestion.explanations[option] ?? "Sem explicacao adicional.",
        isCorrect: correctOptions.includes(option),
        isSelected: selectedOptions.includes(option),
      };
    }).filter((item): item is NonNullable<typeof item> => item !== null);
  }, [answers, currentExplanation, currentQuestion]);

  function handleToggleTopic(code: string) {
    const maxTopics = maxTopicsForCount(questionCount);
    setSelectedTopics((prev) => {
      if (prev.includes(code)) return prev.filter((item) => item !== code);
      if (prev.length >= maxTopics) {
        setFlowError(`Com ${questionCount} questoes, selecione no maximo ${maxTopics} servico(s).`);
        return prev;
      }
      setFlowError(null);
      return [...prev, code];
    });
  }

  function handleQuestionCountChange(next: number) {
    setQuestionCount(next);
    const maxTopics = maxTopicsForCount(next);
    if (selectedTopics.length > maxTopics) setSelectedTopics((prev) => prev.slice(0, maxTopics));
    setFlowError(null);
  }

  function handleStepNext() {
    if (activeStep === 1) {
      setActiveStep(2);
    } else if (activeStep === 2) {
      if (selectedTopics.length === 0) {
        setFlowError("Selecione pelo menos um assunto para continuar.");
        return;
      }
      setFlowError(null);
      setActiveStep(3);
    }
  }

  function handleStepBack() {
    if (activeStep === 2) setActiveStep(1);
    else if (activeStep === 3) setActiveStep(2);
  }

  async function handleSuggestQuestion(service: StudyServiceItem) {
    try {
      await suggestStudyQuestion({ serviceCode: service.code, serviceName: service.name, difficulty: "hard" });
      setSuggestionSent(service.code);
      setTimeout(() => setSuggestionSent(null), 4000);
    } catch { /* silently ignore */ }
  }

  // Polls generate-status until the pool reaches the needed count or timeout fires (Issue #18).
  const startGenerationPolling = useCallback(
    (requestId: string, topics: string[], needed: number, existingQuestions: StudyQuestion[]) => {
      setGeneratingQuestions(true);
      setGenerationTimedOut(false);
      generationDeadlineRef.current = Date.now() + GENERATION_TIMEOUT_MS;

      if (pollTimerRef.current !== null) clearInterval(pollTimerRef.current);

      pollTimerRef.current = setInterval(() => {
        const timedOut = (generationDeadlineRef.current ?? 0) < Date.now();

        if (timedOut) {
          clearInterval(pollTimerRef.current!);
          pollTimerRef.current = null;
          setGeneratingQuestions(false);
          setGenerationTimedOut(true);
          // Fall back to what we have; the flow error explains the situation.
          setQuestions(existingQuestions);
          setFlowError(
            `Geracao demorou mais que o esperado. Iniciando com ${existingQuestions.length} questoes disponíveis.`,
          );
          return;
        }

        pollKcGenerationStatus({ requestId, topics })
          .then(({ count }) => {
            if (count >= needed) {
              clearInterval(pollTimerRef.current!);
              pollTimerRef.current = null;
              // Pool is now sufficient: re-fetch the full set.
              return createKcQuestions({ topics, count: needed }).then(({ questions: fresh }) => {
                setGeneratingQuestions(false);
                setQuestions(fresh);
              });
            }
          })
          .catch(() => {
            // Transient poll failure: keep retrying until timeout.
          });
      }, GENERATION_POLL_INTERVAL_MS);
    },
    [],
  );

  async function startKC() {
    setFlowError(null);
    setCompletionMessage(null);

    const maxTopics = maxTopicsForCount(questionCount);
    if (selectedTopics.length === 0) {
      setFlowError("Selecione pelo menos um assunto para iniciar o KC.");
      return;
    }
    if (selectedTopics.length > maxTopics) {
      setFlowError(`Com ${questionCount} questoes, selecione no maximo ${maxTopics} servico(s).`);
      return;
    }

    setLoadingQuestions(true);
    try {
      const result = await createKcQuestions({ topics: selectedTopics, count: questionCount });

      setAnswers({});
      setCurrentIndex(0);
      setExplanationByQuestion({});
      setSubmittedCurrent(false);

      if (result.insufficient && result.generationRequestId) {
        // Pool had fewer questions than requested: show thematic loading and poll (Issue #18).
        startGenerationPolling(
          result.generationRequestId,
          selectedTopics,
          questionCount,
          result.questions,
        );
      } else {
        setQuestions(result.questions);
      }
    } catch (error) {
      setFlowError(error instanceof Error ? error.message : "Erro ao iniciar KC.");
    } finally {
      setLoadingQuestions(false);
    }
  }

  async function submitCurrentAnswer() {
    if (!currentQuestion) return;
    const normalizedAnswer = normalizeAnswerValue(currentAnswer);
    if (normalizedAnswer.length === 0) { setFlowError("Selecione uma alternativa antes de enviar."); return; }
    setFlowError(null);
    setSubmittingAnswer(true);
    if (explanationByQuestion[currentQuestion.id]) { setSubmittedCurrent(true); setSubmittingAnswer(false); return; }
    try {
      setLoadingExplanation(true);
      const explanation = await createStudyExplanation({
        questionId: currentQuestion.id,
        selectedOption: normalizedAnswer[0],
        selectedOptions: currentQuestion.questionType === "multi" ? normalizedAnswer : undefined,
        optionMapping: currentQuestion.optionMapping,
      });
      setExplanationByQuestion((prev) => ({ ...prev, [currentQuestion.id]: { summary: explanation.summary, options: explanation.options } }));
    } catch {
      setExplanationByQuestion((prev) => ({ ...prev, [currentQuestion.id]: { summary: "Auditoria local baseada no gabarito da questao.", options: currentQuestion.explanations } }));
    } finally {
      setLoadingExplanation(false);
      setSubmittedCurrent(true);
      setSubmittingAnswer(false);
    }
  }

  function goToNextQuestion() {
    if (!currentQuestion || currentIndex >= questions.length - 1) return;
    setCurrentIndex((prev) => prev + 1);
    setSubmittedCurrent(false);
    setFlowError(null);
  }

  function handleConfidenceSelect(confidence: AnswerConfidence) {
    if (!currentQuestion) return;
    setConfidenceByQuestion((prev) => ({ ...prev, [currentQuestion.id]: confidence }));
  }

  function restartKC() {
    setQuestions([]);
    setAnswers({});
    setCurrentIndex(0);
    setExplanationByQuestion({});
    setConfidenceByQuestion({});
    setSubmittedCurrent(false);
    setFlowError(null);
    setReportMessage(null);
    setGeneratingQuestions(false);
    setGenerationTimedOut(false);
    setActiveStep(1);
    if (pollTimerRef.current !== null) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }

  async function rerollKC() { restartKC(); await startKC(); }

  async function finishKC() {
    if (questions.length === 0) return;
    const correctAnswers = questions.filter((q) =>
      isAnswerCorrect({ questionType: q.questionType, answer: answers[q.id], correctOption: q.correctOption, correctOptions: q.correctOptions }),
    ).length;
    const scorePercent = Math.round((correctAnswers / questions.length) * 100);
    // Difficulty is auto-detected per-service; use hard as the scoring anchor for XP.
    const xpPerCorrect = Math.max(20, Math.round(getTaskXpByDifficulty("hard") / 4));
    const gainedXp = correctAnswers * xpPerCorrect;
    const selectedTopicNames = services.filter((s) => selectedTopics.includes(s.code)).map((s) => s.name).slice(0, 4);
    const titleTopics = selectedTopicNames.length > 0 ? selectedTopicNames.join(", ") : selectedTopics.join(", ");
    const sessionTitle = titleTopics ? `Knowledge Check ${titleTopics}` : `Knowledge Check ${questions[0]?.certificationCode ?? "AWS"}`;

    let historySaved = false;
    try {
      const saveResult = await saveStudyHistory({
        sessionType: "KC",
        title: sessionTitle,
        certificationCode: questions[0]?.certificationCode ?? null,
        gainedXp,
        scorePercent,
        correctAnswers,
        totalQuestions: questions.length,
        answersSnapshot: questions.map((q) => {
          const mergedExplanations = {
            A: explanationByQuestion[q.id]?.options.A ?? q.explanations.A ?? "Sem explicacao.",
            B: explanationByQuestion[q.id]?.options.B ?? q.explanations.B ?? "Sem explicacao.",
            C: explanationByQuestion[q.id]?.options.C ?? q.explanations.C ?? "Sem explicacao.",
            D: explanationByQuestion[q.id]?.options.D ?? q.explanations.D ?? "Sem explicacao.",
            E: explanationByQuestion[q.id]?.options.E ?? q.explanations.E ?? "Nao aplicavel.",
          };
          return {
            questionId: q.id,
            statement: q.statement,
            questionType: q.questionType,
            selectedOption: normalizeAnswerValue(answers[q.id])[0] ?? "-",
            selectedOptions: normalizeAnswerValue(answers[q.id]),
            correctOption: q.correctOption,
            correctOptions: normalizeCorrectOptions(q),
            options: q.options,
            optionMapping: q.optionMapping,
            explanationSummary: explanationByQuestion[q.id]?.summary,
            explanations: mergedExplanations,
            // Confidence snapshot for feedback-analysis.worker (RF-09, ADR-05).
            confidence: confidenceByQuestion[q.id] ?? null,
          };
        }),
      });
      historySaved = saveResult.ok;
      if (historySaved) {
        await refreshTotalXp();
        if (saveResult.prevXp != null && saveResult.newXp != null) {
          notifyProgress({
            prevXp: saveResult.prevXp,
            newXp: saveResult.newXp,
            newAchievements: saveResult.newAchievements ?? [],
          });
        }
      }
      setCompletionMessage(`KC finalizado: ${correctAnswers}/${questions.length} (${scorePercent}%). +${gainedXp} XP salvo no historico.`);
      setLastEarnedXp(gainedXp);
    } catch {
      setCompletionMessage(`KC finalizado: ${correctAnswers}/${questions.length} (${scorePercent}%). Nao foi possivel salvar no historico.`);
      setLastEarnedXp(gainedXp);
    }

    setKcSummary({ correct: correctAnswers, total: questions.length, scorePercent, gainedXp, historySaved });
    restartKC();
  }

  async function submitQuestionReport(input: { reason: "INCORRECT_ANSWER" | "UNCLEAR_STATEMENT" | "MISSING_CONTEXT" | "GRAMMAR_TYPO" | "DUPLICATE" | "QUALITY_ISSUE" | "OTHER"; description: string }) {
    if (!currentQuestion) return;
    setReportSubmitting(true);
    setReportMessage(null);
    try {
      await reportStudyQuestion({ questionId: currentQuestion.id, reason: input.reason, description: input.description });
      setReportMessage("Denuncia enviada com sucesso. Obrigado pelo feedback.");
      setTimeout(() => setReportMessage(null), 4500);
    } finally {
      setReportSubmitting(false);
    }
  }

  return (
    <AppLayout>
      <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 xl:px-8 font-sans">
        <AnimatePresence>
          {lastEarnedXp != null && (
            <motion.div
              initial={{ opacity: 0, y: -18, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -24 }}
              transition={{ duration: 0.35 }}
              className="fixed left-1/2 top-24 z-50 w-full max-w-sm -translate-x-1/2 px-4"
              onAnimationComplete={() => { window.setTimeout(() => setLastEarnedXp(null), 1800); }}
            >
              <PixelCard className="border-[var(--pixel-accent)] bg-[var(--pixel-accent)]/20 text-center">
                <p className="font-mono text-[10px] uppercase text-[var(--pixel-accent)]">XP Recebido</p>
                <p className="mt-1 font-sans text-lg">+{lastEarnedXp} XP</p>
              </PixelCard>
            </motion.div>
          )}
        </AnimatePresence>

        <PixelCard>
          <h1 className="font-mono text-sm uppercase text-[var(--pixel-primary)]">KC - Knowledge Check</h1>
          <p className="mt-2 font-sans text-sm text-[var(--pixel-subtext)]">
            Configure a sessao e inicie. A dificuldade e ajustada automaticamente com base nos seus gaps de aprendizado.
          </p>
        </PixelCard>

        {/* Thematic loading screen while on-demand generation runs (Issue #18) */}
        {generatingQuestions && !inProgress && (
          <PixelCard className="space-y-3 border-[var(--pixel-primary)]/50 bg-[var(--pixel-primary)]/5">
            <div className="flex items-center gap-3">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--pixel-primary)] border-r-transparent" />
              <p className="font-mono text-xs text-[var(--pixel-primary)]">
                Chamando o mestre da AWS para checar as questoes...
              </p>
            </div>
            <p className="font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">
              O banco de questoes esta sendo preparado. Isso pode levar ate 90 segundos.
            </p>
          </PixelCard>
        )}

        {!inProgress && !kcSummary && !generatingQuestions && (
          <KCSetupPanel
            activeStep={activeStep}
            services={services}
            servicesLoading={servicesLoading}
            servicesError={servicesError}
            selectedTopics={selectedTopics}
            questionCount={questionCount}
            searchTopic={searchTopic}
            filteredServices={filteredServices}
            pagedServices={pagedServices}
            servicePageCount={servicePageCount}
            currentServicesPage={currentServicesPage}
            loadingQuestions={loadingQuestions}
            flowError={flowError}
            completionMessage={completionMessage}
            suggestionSent={suggestionSent}
            weakServices={weakServices}
            onSearchTopicChange={(v) => { setSearchTopic(v); setServicesPage(1); }}
            onServicesPageChange={setServicesPage}
            onToggleTopic={handleToggleTopic}
            onQuestionCountChange={handleQuestionCountChange}
            onStart={() => void startKC()}
            onSuggestQuestion={(s) => void handleSuggestQuestion(s)}
            onStepNext={handleStepNext}
            onStepBack={handleStepBack}
          />
        )}

        {!inProgress && kcSummary && (
          <KCSummaryCard
            summary={kcSummary}
            onNewKC={() => { setKcSummary(null); router.push("/kc"); }}
            onGoHome={() => { setKcSummary(null); router.push("/home"); }}
          />
        )}

        {inProgress && currentQuestion && (
          <>
            {/* Timeout warning: shown after polling gives up (Issue #18) */}
            {generationTimedOut && (
              <PixelCard className="border-yellow-500/50 bg-yellow-900/10">
                <p className="font-[var(--font-body)] text-sm text-yellow-300">
                  Geracao de questoes demorou mais que o esperado. Iniciando com {questions.length} questoes disponíveis.
                </p>
              </PixelCard>
            )}

            <KCQuestionFlow
              questions={questions}
              currentIndex={currentIndex}
              currentQuestion={currentQuestion}
              answers={answers}
              stats={stats}
              submittedCurrent={submittedCurrent}
              submittingAnswer={submittingAnswer}
              loadingExplanation={loadingExplanation}
              isCurrentCorrect={isCurrentCorrect}
              currentExplanation={currentExplanation}
              currentReviewOptions={currentReviewOptions}
              flowError={flowError}
              reportMessage={reportMessage}
              reportModalOpen={reportModalOpen}
              reportSubmitting={reportSubmitting}
              currentConfidence={currentQuestion ? confidenceByQuestion[currentQuestion.id] : undefined}
              onAnswerChange={(id, value) => setAnswers((prev) => ({ ...prev, [id]: value }))}
              onSubmitAnswer={() => void submitCurrentAnswer()}
              onNextQuestion={goToNextQuestion}
              onFinishKC={() => void finishKC()}
              onReroll={() => void rerollKC()}
              onOpenReport={() => setReportModalOpen(true)}
              onCloseReport={() => setReportModalOpen(false)}
              onSubmitReport={(input) => submitQuestionReport(input)}
              onConfidenceSelect={handleConfidenceSelect}
            />
          </>
        )}
      </main>
    </AppLayout>
  );
}
