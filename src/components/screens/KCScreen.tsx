"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AppLayout } from "@/components/AppLayout";
import { PixelButton } from "@/components/ui/PixelButton";
import { PixelCard } from "@/components/ui/PixelCard";
import { getTaskXpByDifficulty } from "@/lib/levels";
import { QuestionOption, StudyQuestion, TaskDifficulty } from "@/lib/types";

type ServiceItem = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
};

type ExplanationResult = {
  summary: string;
  options: Partial<Record<QuestionOption, string>>;
};

type AnswerMap = Record<string, QuestionOption | undefined>;

const DIFFICULTIES: TaskDifficulty[] = ["easy", "medium", "hard"];
const OPTIONS: QuestionOption[] = ["A", "B", "C", "D", "E"];
const SERVICES_PAGE_SIZE = 12;

export function KCScreen() {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [servicesError, setServicesError] = useState<string | null>(null);

  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [selectedDifficulty, setSelectedDifficulty] = useState<TaskDifficulty>("easy");
  const [searchTopic, setSearchTopic] = useState("");
  const [servicesPage, setServicesPage] = useState(1);

  const [questions, setQuestions] = useState<StudyQuestion[]>([]);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [submittedCurrent, setSubmittedCurrent] = useState(false);
  const [completionMessage, setCompletionMessage] = useState<string | null>(null);
  const [explanationByQuestion, setExplanationByQuestion] = useState<Record<string, ExplanationResult>>({});
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [loadingExplanation, setLoadingExplanation] = useState(false);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [lastEarnedXp, setLastEarnedXp] = useState<number | null>(null);
  const [flowError, setFlowError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/study/services")
      .then((response) => response.json())
      .then((data: { services?: ServiceItem[]; error?: string }) => {
        if (data.error) throw new Error(data.error);
        setServices(data.services ?? []);
      })
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
    const answered = questions.filter((question) => answers[question.id]).length;
    const correct = questions.filter((question) => {
      const answer = answers[question.id];
      return answer && answer === question.correctOption;
    }).length;

    return {
      answered,
      total: questions.length,
      correct,
      wrong: Math.max(0, answered - correct),
    };
  }, [answers, questions]);

  const isCurrentCorrect = Boolean(currentQuestion && currentAnswer === currentQuestion.correctOption);

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
      const response = await fetch("/api/study/kc/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topics: selectedTopics,
          difficulty: selectedDifficulty,
          count: 10,
        }),
      });

      const data = (await response.json()) as { questions?: StudyQuestion[]; error?: string };
      if (!response.ok || !data.questions?.length) {
        throw new Error(data.error ?? "Nao foi possivel iniciar o KC.");
      }

      setQuestions(data.questions);
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
    if (!answers[currentQuestion.id]) {
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

      const response = await fetch("/api/study/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: currentQuestion.id,
          selectedOption: answers[currentQuestion.id],
          optionMapping: currentQuestion.optionMapping,
        }),
      });

      const data = (await response.json()) as {
        summary?: string;
        options?: Partial<Record<QuestionOption, string>>;
      };

      if (!response.ok || !data.options) {
        throw new Error("Nao foi possivel gerar auditoria por IA.");
      }

      setExplanationByQuestion((prev) => ({
        ...prev,
        [currentQuestion.id]: {
          summary: data.summary ?? "Resumo indisponivel.",
          options: data.options ?? {},
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

    const correctAnswers = questions.filter((question) => answers[question.id] === question.correctOption).length;
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

    try {
      await fetch("/api/study/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
              selectedOption: answers[question.id] ?? "-",
              correctOption: question.correctOption,
              options: question.options,
              optionMapping: question.optionMapping,
              explanations: mergedExplanations,
            };
          }),
        }),
      });

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

    restartKC();
  }

  return (
    <AppLayout>
      <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 xl:px-8">
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
                <p className="font-[var(--font-pixel)] text-[10px] uppercase text-[var(--pixel-accent)]">XP Recebido</p>
                <p className="mt-1 font-[var(--font-body)] text-lg">+{lastEarnedXp} XP</p>
              </PixelCard>
            </motion.div>
          )}
        </AnimatePresence>

        <PixelCard>
          <h1 className="font-[var(--font-pixel)] text-sm uppercase text-[var(--pixel-primary)]">
            KC - Knowledge Check
          </h1>
          <p className="mt-2 font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
            Escolha assunto e dificuldade antes de iniciar. O fluxo de resposta e por questao, com auditoria completa
            quando houver erro.
          </p>
        </PixelCard>

        {!inProgress && (
          <PixelCard className="space-y-4">
            <h2 className="font-[var(--font-pixel)] text-xs uppercase text-[var(--pixel-primary)]">Configurar KC</h2>

            {completionMessage && (
              <p className="font-[var(--font-body)] text-sm text-[var(--pixel-accent)]">{completionMessage}</p>
            )}

            <div className="space-y-2">
              <p className="font-[var(--font-pixel)] text-[10px] uppercase text-[var(--pixel-subtext)]">Assuntos AWS</p>
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
                          <p className="font-[var(--font-body)] text-sm">{service.name}</p>
                          <p className="font-[var(--font-pixel)] text-[9px] uppercase text-[var(--pixel-subtext)]">
                            {service.code}
                          </p>
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
              <p className="font-[var(--font-pixel)] text-[10px] uppercase text-[var(--pixel-subtext)]">Dificuldade</p>
              <div className="flex flex-wrap gap-2">
                {DIFFICULTIES.map((difficulty) => {
                  const selected = selectedDifficulty === difficulty;
                  return (
                    <button
                      key={difficulty}
                      type="button"
                      onClick={() => setSelectedDifficulty(difficulty)}
                      className={`border px-3 py-2 font-[var(--font-pixel)] text-[10px] uppercase ${
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

        {inProgress && currentQuestion && (
          <>
            <PixelCard className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-[var(--font-pixel)] text-[10px] uppercase text-[var(--pixel-subtext)]">
                Questao {currentIndex + 1}/{questions.length} · Acertos: {stats.correct} · Erros: {stats.wrong}
              </p>
              <PixelButton variant="ghost" onClick={() => void rerollKC()}>
                Reiniciar
              </PixelButton>
            </PixelCard>

            <PixelCard className="space-y-4">
              <p className="font-[var(--font-pixel)] text-[10px] uppercase text-[var(--pixel-subtext)]">
                {currentQuestion.topic} · {currentQuestion.difficulty}
              </p>
              <p className="font-[var(--font-body)] text-base">{currentQuestion.statement}</p>

              <div className="grid gap-2">
                {OPTIONS.map((option) => {
                  const optionText = currentQuestion.options[option];
                  if (!optionText) return null;
                  const checked = answers[currentQuestion.id] === option;
                  const isCorrectOption = submittedCurrent && option === currentQuestion.correctOption;
                  const isSelectedWrong =
                    submittedCurrent && checked && answers[currentQuestion.id] !== currentQuestion.correctOption;
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
                        type="radio"
                        name={currentQuestion.id}
                        value={option}
                        checked={checked}
                        onChange={() =>
                          setAnswers((prev) => ({
                            ...prev,
                            [currentQuestion.id]: option,
                          }))
                        }
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
                  <p className="font-[var(--font-pixel)] text-[10px] uppercase">
                    {isCurrentCorrect ? "✓ Resposta correta" : "✗ Resposta incorreta"}
                  </p>

                  {loadingExplanation && (
                    <p className="mt-2 font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">
                      Gerando auditoria detalhada com IA...
                    </p>
                  )}

                  <p className="mt-2 font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
                    {currentExplanation?.summary ?? "Analise das alternativas para reforcar o aprendizado."}
                  </p>

                  <div className="mt-2 space-y-2">
                    {OPTIONS.map((option) => {
                      const text = currentQuestion.options[option];
                      if (!text) return null;

                      const isCorrectOption = option === currentQuestion.correctOption;
                      const isSelected = option === answers[currentQuestion.id];

                      return (
                        <div
                          key={`${currentQuestion.id}-audit-${option}`}
                          className="border border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2"
                        >
                          <p className="font-[var(--font-pixel)] text-[9px] uppercase text-[var(--pixel-subtext)]">
                            {option}) {isCorrectOption ? "correta" : "incorreta"}
                            {isSelected ? " · sua resposta" : ""}
                          </p>
                          <p className="mt-1 font-[var(--font-body)] text-sm">
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

              {flowError && <p className="font-[var(--font-body)] text-sm text-red-300">{flowError}</p>}

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
