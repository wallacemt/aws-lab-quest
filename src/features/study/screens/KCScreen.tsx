"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { PixelButton } from "@/components/ui/pixel-button";
import { PixelCard } from "@/components/ui/pixel-card";
import { useUserProfile } from "@/hooks/useUserProfile";
import { STUDY_DIFFICULTIES, STUDY_OPTIONS, StudyAnswerMap, StudyExplanationResult } from "@/features/study";
import {
  createKcQuestions,
  createStudyExplanation,
  isAnswerCorrect,
  listStudyServices,
  normalizeAnswerValue,
  normalizeCorrectOptions,
  saveStudyHistory,
  StudyServiceItem,
} from "@/features/study/services";
import { getTaskXpByDifficulty } from "@/lib/levels";
import { QuestionOption, StudyQuestion, TaskDifficulty } from "@/lib/types";
import { cn } from "@/lib/utils";

const DIFFICULTIES: TaskDifficulty[] = STUDY_DIFFICULTIES;
const OPTIONS: QuestionOption[] = STUDY_OPTIONS;
const SERVICES_PAGE_SIZE = 12;

function toggleMultiAnswer(current: QuestionOption[], option: QuestionOption): QuestionOption[] {
  if (current.includes(option)) {
    return current.filter((item) => item !== option).sort();
  }
  return [...current, option].sort();
}

export function KCScreen() {
  const router = useRouter();
  const { refreshTotalXp } = useUserProfile();

  const [services, setServices] = useState<StudyServiceItem[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [servicesError, setServicesError] = useState<string | null>(null);

  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [selectedDifficulty, setSelectedDifficulty] = useState<TaskDifficulty>("easy");
  const [searchTopic, setSearchTopic] = useState("");
  const [servicesPage, setServicesPage] = useState(1);

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

  useEffect(() => {
    listStudyServices()
      .then((items) => setServices(items))
      .catch((error) => setServicesError(error instanceof Error ? error.message : "Falha ao carregar serviços AWS."))
      .finally(() => setServicesLoading(false));
  }, []);

  const inProgress = questions.length > 0;
  const currentQuestion = questions[currentIndex] ?? null;
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : undefined;

  const filteredServices = useMemo(() => {
    const term = searchTopic.trim().toLowerCase();
    if (!term) {
      return services;
    }

    return services.filter((service) => {
      const haystack = `${service.name} ${service.code} ${service.description ?? ""}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [searchTopic, services]);

  const servicePageCount = Math.max(1, Math.ceil(filteredServices.length / SERVICES_PAGE_SIZE));
  const currentServicesPage = Math.max(1, Math.min(servicesPage, servicePageCount));
  const pagedServices = filteredServices.slice(
    (currentServicesPage - 1) * SERVICES_PAGE_SIZE,
    currentServicesPage * SERVICES_PAGE_SIZE,
  );

  const stats = useMemo(() => {
    const answered = questions.filter((question) => normalizeAnswerValue(answers[question.id]).length > 0).length;
    const correct = questions.filter((question) => {
      const answer = answers[question.id];
      if (!answer) {
        return false;
      }

      return isAnswerCorrect({
        questionType: question.questionType,
        answer,
        correctOption: question.correctOption,
        correctOptions: question.correctOptions,
      });
    }).length;

    return {
      answered,
      total: questions.length,
      correct,
      wrong: Math.max(0, answered - correct),
    };
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

  function toggleTopic(code: string) {
    setSelectedTopics((prev) => (prev.includes(code) ? prev.filter((item) => item !== code) : [...prev, code]));
  }

  async function startKC() {
    setFlowError(null);
    setCompletionMessage(null);

    if (selectedTopics.length === 0) {
      setFlowError("Selecione pelo menos um assunto para iniciar o KC.");
      return;
    }

    setLoadingQuestions(true);
    try {
      const nextQuestions = await createKcQuestions({
        topics: selectedTopics,
        difficulty: selectedDifficulty,
        count: 10,
      });

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
    if (normalizedAnswer.length === 0) {
      setFlowError("Selecione uma alternativa antes de enviar.");
      return;
    }

    setFlowError(null);
    setSubmittingAnswer(true);

    if (explanationByQuestion[currentQuestion.id]) {
      setSubmittedCurrent(true);
      setSubmittingAnswer(false);
      return;
    }

    try {
      setLoadingExplanation(true);
      const explanation = await createStudyExplanation({
        questionId: currentQuestion.id,
        selectedOption: normalizedAnswer[0],
        selectedOptions: currentQuestion.questionType === "multi" ? normalizedAnswer : undefined,
        optionMapping: currentQuestion.optionMapping,
      });

      setExplanationByQuestion((prev) => ({
        ...prev,
        [currentQuestion.id]: {
          summary: explanation.summary,
          options: explanation.options,
        },
      }));
    } catch {
      setExplanationByQuestion((prev) => ({
        ...prev,
        [currentQuestion.id]: {
          summary: "Auditoria local baseada no gabarito da questao.",
          options: currentQuestion.explanations,
        },
      }));
    } finally {
      setLoadingExplanation(false);
      setSubmittedCurrent(true);
      setSubmittingAnswer(false);
    }
  }

  function goToNextQuestion() {
    if (!currentQuestion) return;
    if (currentIndex >= questions.length - 1) return;

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
  }

  async function rerollKC() {
    restartKC();
    await startKC();
  }

  async function finishKC() {
    if (questions.length === 0) return;

    const correctAnswers = questions.filter((question) => {
      return isAnswerCorrect({
        questionType: question.questionType,
        answer: answers[question.id],
        correctOption: question.correctOption,
        correctOptions: question.correctOptions,
      });
    }).length;
    const scorePercent = Math.round((correctAnswers / questions.length) * 100);
    const xpPerCorrect = Math.max(20, Math.round(getTaskXpByDifficulty(selectedDifficulty) / 4));
    const gainedXp = correctAnswers * xpPerCorrect;
    const selectedTopicNames = services
      .filter((service) => selectedTopics.includes(service.code))
      .map((service) => service.name)
      .slice(0, 4);

    const titleTopics = selectedTopicNames.length > 0 ? selectedTopicNames.join(", ") : selectedTopics.join(", ");
    const sessionTitle = titleTopics
      ? `Knowledge Check ${titleTopics}`
      : `Knowledge Check ${questions[0]?.certificationCode ?? "AWS"}`;

    let historySaved = false;
    try {
      historySaved = await saveStudyHistory({
        sessionType: "KC",
        title: sessionTitle,
        certificationCode: questions[0]?.certificationCode ?? null,
        gainedXp,
        scorePercent,
        correctAnswers,
        totalQuestions: questions.length,
        answersSnapshot: questions.map((question) => {
          const mergedExplanations = {
            A: explanationByQuestion[question.id]?.options.A ?? question.explanations.A ?? "Sem explicacao.",
            B: explanationByQuestion[question.id]?.options.B ?? question.explanations.B ?? "Sem explicacao.",
            C: explanationByQuestion[question.id]?.options.C ?? question.explanations.C ?? "Sem explicacao.",
            D: explanationByQuestion[question.id]?.options.D ?? question.explanations.D ?? "Sem explicacao.",
            E: explanationByQuestion[question.id]?.options.E ?? question.explanations.E ?? "Nao aplicavel.",
          };

          return {
            questionId: question.id,
            statement: question.statement,
            questionType: question.questionType,
            selectedOption: normalizeAnswerValue(answers[question.id])[0] ?? "-",
            selectedOptions: normalizeAnswerValue(answers[question.id]),
            correctOption: question.correctOption,
            correctOptions: normalizeCorrectOptions(question),
            options: question.options,
            optionMapping: question.optionMapping,
            explanations: mergedExplanations,
          };
        }),
      });

      if (historySaved) {
        await refreshTotalXp();
      }

      setCompletionMessage(
        `KC finalizado: ${correctAnswers}/${questions.length} (${scorePercent}%). +${gainedXp} XP salvo no historico.`,
      );
      setLastEarnedXp(gainedXp);
    } catch {
      setCompletionMessage(
        `KC finalizado: ${correctAnswers}/${questions.length} (${scorePercent}%). Nao foi possivel salvar no historico.`,
      );
      setLastEarnedXp(gainedXp);
    }

    setKcSummary({
      correct: correctAnswers,
      total: questions.length,
      scorePercent,
      gainedXp,
      historySaved,
    });

    restartKC();
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
              onAnimationComplete={() => {
                window.setTimeout(() => setLastEarnedXp(null), 1800);
              }}
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

        {!inProgress && (
          <PixelCard className="space-y-4">
            <h2 className="font-mono text-xs uppercase text-[var(--pixel-primary)]">Configurar KC</h2>

            {completionMessage && (
              <p className="font-[var(--font-body)] text-sm text-[var(--pixel-accent)]">{completionMessage}</p>
            )}

            <div className="space-y-2">
              <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Assuntos AWS</p>
              {servicesLoading && <p className="font-[var(--font-body)] text-sm">Carregando servicos...</p>}
              {servicesError && <p className="font-[var(--font-body)] text-sm text-red-300">{servicesError}</p>}
              {!servicesLoading && !servicesError && (
                <div className="space-y-3">
                  <input
                    type="search"
                    value={searchTopic}
                    onChange={(event) => {
                      setSearchTopic(event.target.value);
                      setServicesPage(1);
                    }}
                    placeholder="Buscar por nome ou codigo do servico"
                    className="w-full border border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2 font-[var(--font-body)] text-sm"
                  />

                  <div className="grid gap-2 sm:grid-cols-2">
                    {pagedServices.map((service) => {
                      const selected = selectedTopics.includes(service.code);
                      return (
                        <button
                          key={service.id}
                          type="button"
                          onClick={() => toggleTopic(service.code)}
                          className={`border px-3 py-2 text-left font-[var(--font-body)] text-sm ${
                            selected
                              ? "border-[var(--pixel-primary)] bg-[var(--pixel-primary)]/10"
                              : "border-[var(--pixel-border)] bg-[var(--pixel-bg)]"
                          }`}
                        >
                          <p className="font-sans text-sm">{service.name}</p>
                          <p className="font-mono text-[9px] uppercase text-[var(--pixel-subtext)]">{service.code}</p>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <p className="font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">
                      Pagina {currentServicesPage}/{servicePageCount} · {filteredServices.length} servicos encontrados
                    </p>
                    <div className="flex gap-2">
                      <PixelButton
                        variant="ghost"
                        onClick={() => setServicesPage((prev) => Math.max(1, prev - 1))}
                        disabled={currentServicesPage <= 1}
                      >
                        Anterior
                      </PixelButton>
                      <PixelButton
                        variant="ghost"
                        onClick={() => setServicesPage((prev) => Math.min(servicePageCount, prev + 1))}
                        disabled={currentServicesPage >= servicePageCount}
                      >
                        Proxima
                      </PixelButton>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Dificuldade</p>
              <div className="flex flex-wrap gap-2">
                {DIFFICULTIES.map((difficulty) => {
                  const selected = selectedDifficulty === difficulty;
                  return (
                    <button
                      key={difficulty}
                      type="button"
                      onClick={() => setSelectedDifficulty(difficulty)}
                      className={`border px-3 py-2 font-mono text-[10px] uppercase ${
                        selected
                          ? "border-[var(--pixel-primary)] bg-[var(--pixel-primary)]/10"
                          : "border-[var(--pixel-border)] bg-[var(--pixel-bg)]"
                      }`}
                    >
                      {difficulty}
                    </button>
                  );
                })}
              </div>
            </div>

            {flowError && <p className="font-[var(--font-body)] text-sm text-red-300">{flowError}</p>}

            <div className="flex justify-end">
              <PixelButton onClick={startKC} disabled={loadingQuestions}>
                {loadingQuestions ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-3 w-3 animate-spin rounded-full border border-current border-r-transparent" />
                    Gerando KC...
                  </span>
                ) : (
                  "Iniciar KC"
                )}
              </PixelButton>
            </div>
          </PixelCard>
        )}

        {!inProgress && kcSummary && (
          <PixelCard className="space-y-4 border-[var(--pixel-accent)] bg-[var(--pixel-accent)]/10">
            <p className="font-mono text-[10px] uppercase text-[var(--pixel-accent)]">KC Finalizado</p>
            <p className="font-[var(--font-body)] text-base">
              Pontuacao: {kcSummary.scorePercent}% ({kcSummary.correct}/{kcSummary.total}) · +{kcSummary.gainedXp} XP
            </p>
            <p className="font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
              {kcSummary.historySaved
                ? "Resultado salvo no historico com sucesso."
                : "Resultado concluido, mas nao foi possivel salvar no historico."}
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <PixelButton
                onClick={() => {
                  setKcSummary(null);
                  router.push("/kc");
                }}
              >
                Fazer outro KC
              </PixelButton>
              <PixelButton
                variant="ghost"
                onClick={() => {
                  setKcSummary(null);
                  router.push("/");
                }}
              >
                Voltar ao inicio
              </PixelButton>
            </div>
          </PixelCard>
        )}

        {inProgress && currentQuestion && (
          <>
            <PixelCard className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">
                Questao {currentIndex + 1}/{questions.length} · Acertos: {stats.correct} · Erros: {stats.wrong}
              </p>
              <PixelButton variant="ghost" onClick={() => void rerollKC()}>
                Reiniciar
              </PixelButton>
            </PixelCard>

            <PixelCard className="space-y-4">
              <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">
                {currentQuestion.topic} · {currentQuestion.difficulty}
              </p>
              <p className="font-[var(--font-body)] text-base">{currentQuestion.statement}</p>
              {currentQuestion.questionType === "multi" && (
                <p className="font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">
                  Questao multipla: selecione todas as alternativas corretas.
                </p>
              )}

              <div className="grid gap-4">
                {OPTIONS.map((option) => {
                  const optionText = currentQuestion.options[option];
                  if (!optionText) return null;
                  const selectedOptions = normalizeAnswerValue(answers[currentQuestion.id]);
                  const checked = selectedOptions.includes(option);
                  const correctOptions = normalizeCorrectOptions(currentQuestion);
                  const isCorrectOption = submittedCurrent && correctOptions.includes(option);
                  const isSelectedWrong = submittedCurrent && checked && !isCorrectOption;
                  return (
                    <label
                      key={`${currentQuestion.id}-${option}`}
                      className={`flex items-start gap-4 border-2 px-3 py-2 ${
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
                        value={option}
                        checked={checked}
                        onChange={() => {
                          setAnswers((prev) => {
                            const current = normalizeAnswerValue(prev[currentQuestion.id]);
                            const nextValue =
                              currentQuestion.questionType === "multi" ? toggleMultiAnswer(current, option) : option;

                            return {
                              ...prev,
                              [currentQuestion.id]: nextValue,
                            };
                          });
                        }}
                        disabled={submittedCurrent}
                      />
                      <span className="font-[var(--font-body)] text-sm">
                        {option}) {optionText}
                      </span>
                    </label>
                  );
                })}
              </div>

              {submittingAnswer && (
                <PixelCard className="border-[var(--pixel-primary)] bg-[var(--pixel-primary)]/10">
                  <p className="inline-flex items-center gap-2 font-[var(--font-body)] text-sm">
                    <span className="h-3 w-3 animate-spin rounded-full border border-current border-r-transparent" />
                    Gerando explicacao da IA...
                  </p>
                </PixelCard>
              )}

              {submittedCurrent && (
                <PixelCard
                  className={isCurrentCorrect ? "border-[#2ecc71] bg-green-900/25" : "border-[#e74c3c] bg-red-900/25"}
                >
                  <p className="font-mono text-[10px] uppercase">
                    {isCurrentCorrect ? "✓ Resposta correta" : "✗ Resposta incorreta"}
                  </p>

                  {loadingExplanation && (
                    <p className="mt-2 font-sans text-xs text-[var(--pixel-subtext)]">
                      Gerando auditoria detalhada com IA...
                    </p>
                  )}

                  <p className="mt-2 font-sans text-sm text-[var(--pixel-subtext)]">
                    {currentExplanation?.summary ?? "Analise das alternativas para reforcar o aprendizado."}
                  </p>

                  <div className="mt-2 space-y-2">
                    {OPTIONS.map((option) => {
                      const text = currentQuestion.options[option];
                      if (!text) return null;

                      const isCorrectOption = normalizeCorrectOptions(currentQuestion).includes(option);
                      const isSelected = normalizeAnswerValue(answers[currentQuestion.id]).includes(option);

                      return (
                        <div
                          key={`${currentQuestion.id}-audit-${option}`}
                          className={cn(
                            "border border-pixel-border bg-pixel-card px-3 py-2",
                            isSelected && " border-2 ",
                            isCorrectOption ? "border-green-400" : "border-red-400",
                          )}
                        >
                          <p className={cn("font-mono text-[9px] uppercase text-[var(--pixel-subtext)]")}>
                            {option} {isCorrectOption ? "correta" : "incorreta"}
                            <span className="text-primary font-bold">{isSelected ? " · sua resposta" : ""}</span>
                          </p>
                          <p className="mt-1 font-sans text-sm">
                            {currentExplanation?.options[option] ??
                              currentQuestion.explanations[option] ??
                              "Sem explicacao adicional."}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </PixelCard>
              )}

              {flowError && <p className="font-sans text-sm text-red-300">{flowError}</p>}

              <div className="flex flex-wrap justify-end gap-2">
                {!submittedCurrent ? (
                  <PixelButton onClick={submitCurrentAnswer} disabled={loadingExplanation || submittingAnswer}>
                    {submittingAnswer ? "Gerando feedback..." : "Enviar resposta"}
                  </PixelButton>
                ) : currentIndex < questions.length - 1 ? (
                  <PixelButton onClick={goToNextQuestion}>Proxima</PixelButton>
                ) : (
                  <PixelButton onClick={finishKC}>Finalizar KC</PixelButton>
                )}
              </div>
            </PixelCard>
          </>
        )}
      </main>
    </AppLayout>
  );
}
