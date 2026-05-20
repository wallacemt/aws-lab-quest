"use client";

import { useEffect, useMemo, useState } from "react";
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
  isAnswerCorrect,
  listStudyServices,
  normalizeAnswerValue,
  normalizeCorrectOptions,
  reportStudyQuestion,
  saveStudyHistory,
  suggestStudyQuestion,
  StudyServiceItem,
} from "@/features/study/services";
import { getTaskXpByDifficulty } from "@/lib/levels";
import { normalizeOptionText } from "@/lib/study-option-text";
import { QuestionOption, StudyQuestion, TaskDifficulty } from "@/lib/types";
import { STUDY_OPTIONS } from "@/features/study/constants";

const OPTIONS: QuestionOption[] = STUDY_OPTIONS;
const SERVICES_PAGE_SIZE = 12;

function maxTopicsForCount(count: number): number {
  return Math.max(1, Math.floor(count / 5));
}

export function KCScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshTotalXp } = useUserProfile();

  // Services
  const [services, setServices] = useState<StudyServiceItem[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [servicesError, setServicesError] = useState<string | null>(null);

  // Setup state
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [selectedDifficulty, setSelectedDifficulty] = useState<TaskDifficulty>("easy");
  const [questionCount, setQuestionCount] = useState(10);
  const [searchTopic, setSearchTopic] = useState("");
  const [servicesPage, setServicesPage] = useState(1);
  const [suggestionSent, setSuggestionSent] = useState<string | null>(null);

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

  useEffect(() => {
    setServicesLoading(true);
    listStudyServices({ withCount: true, difficulty: selectedDifficulty })
      .then((items) => setServices(items))
      .catch((error) => setServicesError(error instanceof Error ? error.message : "Falha ao carregar serviços AWS."))
      .finally(() => setServicesLoading(false));
  }, [selectedDifficulty]);

  useEffect(() => {
    const topicsRaw = searchParams.get("topics");
    if (!topicsRaw || services.length === 0) return;
    const requested = topicsRaw.split(",").map((item) => item.trim().toUpperCase()).filter(Boolean);
    if (requested.length === 0) return;
    const maxTopics = maxTopicsForCount(questionCount);
    const availableCodes = new Set(services.map((s) => s.code.toUpperCase()));
    const preselected = Array.from(new Set(requested)).filter((c) => availableCodes.has(c)).slice(0, maxTopics);
    if (preselected.length > 0) setSelectedTopics(preselected);
  }, [searchParams, services, questionCount]);

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

  async function handleSuggestQuestion(service: StudyServiceItem) {
    try {
      await suggestStudyQuestion({ serviceCode: service.code, serviceName: service.name, difficulty: selectedDifficulty });
      setSuggestionSent(service.code);
      setTimeout(() => setSuggestionSent(null), 4000);
    } catch { /* silently ignore */ }
  }

  async function startKC() {
    setFlowError(null);
    setCompletionMessage(null);
    const maxTopics = maxTopicsForCount(questionCount);
    if (selectedTopics.length === 0) { setFlowError("Selecione pelo menos um assunto para iniciar o KC."); return; }
    if (selectedTopics.length > maxTopics) { setFlowError(`Com ${questionCount} questoes, selecione no maximo ${maxTopics} servico(s).`); return; }
    setLoadingQuestions(true);
    try {
      const nextQuestions = await createKcQuestions({ topics: selectedTopics, difficulty: selectedDifficulty, count: questionCount });
      setQuestions(nextQuestions);
      setAnswers({});
      setCurrentIndex(0);
      setExplanationByQuestion({});
      setSubmittedCurrent(false);
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

  function restartKC() {
    setQuestions([]);
    setAnswers({});
    setCurrentIndex(0);
    setExplanationByQuestion({});
    setSubmittedCurrent(false);
    setFlowError(null);
    setReportMessage(null);
  }

  async function rerollKC() { restartKC(); await startKC(); }

  async function finishKC() {
    if (questions.length === 0) return;
    const correctAnswers = questions.filter((q) =>
      isAnswerCorrect({ questionType: q.questionType, answer: answers[q.id], correctOption: q.correctOption, correctOptions: q.correctOptions }),
    ).length;
    const scorePercent = Math.round((correctAnswers / questions.length) * 100);
    const xpPerCorrect = Math.max(20, Math.round(getTaskXpByDifficulty(selectedDifficulty) / 4));
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
          };
        }),
      });
      historySaved = saveResult.ok;
      if (historySaved) await refreshTotalXp();
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
            Escolha assunto e dificuldade antes de iniciar. O fluxo de resposta e por questao, com auditoria completa
            quando houver erro.
          </p>
        </PixelCard>

        {!inProgress && !kcSummary && (
          <KCSetupPanel
            services={services}
            servicesLoading={servicesLoading}
            servicesError={servicesError}
            selectedTopics={selectedTopics}
            selectedDifficulty={selectedDifficulty}
            questionCount={questionCount}
            searchTopic={searchTopic}
            servicesPage={servicesPage}
            filteredServices={filteredServices}
            pagedServices={pagedServices}
            servicePageCount={servicePageCount}
            currentServicesPage={currentServicesPage}
            loadingQuestions={loadingQuestions}
            flowError={flowError}
            completionMessage={completionMessage}
            suggestionSent={suggestionSent}
            onSearchTopicChange={(v) => { setSearchTopic(v); setServicesPage(1); }}
            onServicesPageChange={setServicesPage}
            onToggleTopic={handleToggleTopic}
            onDifficultyChange={setSelectedDifficulty}
            onQuestionCountChange={handleQuestionCountChange}
            onStart={() => void startKC()}
            onSuggestQuestion={(s) => void handleSuggestQuestion(s)}
          />
        )}

        {!inProgress && kcSummary && (
          <KCSummaryCard
            summary={kcSummary}
            onNewKC={() => { setKcSummary(null); router.push("/kc"); }}
            onGoHome={() => { setKcSummary(null); router.push("/"); }}
          />
        )}

        {inProgress && currentQuestion && (
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
            onAnswerChange={(id, value) => setAnswers((prev) => ({ ...prev, [id]: value }))}
            onSubmitAnswer={() => void submitCurrentAnswer()}
            onNextQuestion={goToNextQuestion}
            onFinishKC={() => void finishKC()}
            onReroll={() => void rerollKC()}
            onOpenReport={() => setReportModalOpen(true)}
            onCloseReport={() => setReportModalOpen(false)}
            onSubmitReport={(input) => submitQuestionReport(input)}
          />
        )}
      </main>
    </AppLayout>
  );
}
