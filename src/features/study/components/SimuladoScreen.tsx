"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/AppLayout";
import { PixelButton } from "@/components/ui/PixelButton";
import { PixelCard } from "@/components/ui/PixelCard";
import { STUDY_DIFFICULTIES, STUDY_OPTIONS, StudyAnswerMap, StudyExplanationResult } from "@/features/study";
import { createSimuladoQuestions, createStudyExplanation, saveStudyHistory } from "@/features/study/services";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useSimulatedExam } from "@/hooks/useSimulatedExam";
import { useUserProfile } from "@/hooks/useUserProfile";
import { getTaskXpByDifficulty } from "@/lib/levels";
import { STORAGE_KEYS } from "@/lib/storage";
import { QuestionOption, StudyQuestion, TaskDifficulty } from "@/lib/types";

const OPTIONS: QuestionOption[] = STUDY_OPTIONS;
const DIFFICULTIES: TaskDifficulty[] = STUDY_DIFFICULTIES;

type ExamResult = {
  certificationCode: string;
  correct: number;
  total: number;
  scorePercent: number;
  historySaved: boolean;
};

type RulesConsentMap = Record<string, string>;

function formatTime(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const mm = Math.floor(clamped / 60)
    .toString()
    .padStart(2, "0");
  const ss = (clamped % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

export function SimuladoScreen() {
  const router = useRouter();
  const { hydrated, isActive, remainingSeconds, session, startSession, submitSession, clearSession } =
    useSimulatedExam();
  const { profile } = useUserProfile();
  const rulesConsent = useLocalStorage<RulesConsentMap>(STORAGE_KEYS.simuladoRulesConsent, {});

  const [questions, setQuestions] = useState<StudyQuestion[]>([]);
  const [answers, setAnswers] = useState<StudyAnswerMap>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [reviewByQuestion, setReviewByQuestion] = useState<Record<string, StudyExplanationResult>>({});
  const [loadingReviewByQuestion, setLoadingReviewByQuestion] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [selectedDifficulties, setSelectedDifficulties] = useState<TaskDifficulty[]>(["easy", "medium", "hard"]);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [rulesAccepted, setRulesAccepted] = useState(false);

  const inExamFlow = isActive && questions.length > 0 && !submitted;
  const inReviewFlow = submitted && questions.length > 0;
  const currentQuestion = questions[currentIndex] ?? null;
  const answeredCount = useMemo(() => questions.filter((q) => answers[q.id]).length, [answers, questions]);
  const timerLabel = useMemo(() => formatTime(remainingSeconds), [remainingSeconds]);

  const currentReview = currentQuestion ? reviewByQuestion[currentQuestion.id] : undefined;
  const consentScope = profile.certificationPresetCode?.trim() || "default";

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    // A stale persisted session without restored question state would lock navigation globally.
    if (isActive && questions.length === 0 && !submitted && !loading) {
      clearSession();
      setError("Sessao anterior de simulado expirada ou incompleta. Inicie um novo simulado para continuar.");
    }
  }, [clearSession, hydrated, isActive, loading, questions.length, submitted]);

  function hasValidRulesConsent(scope: string): boolean {
    const raw = rulesConsent.value[scope];
    if (!raw) {
      return false;
    }

    const expiresAt = new Date(raw).getTime();
    return Number.isFinite(expiresAt) && expiresAt > Date.now();
  }

  function persistRulesConsent(scope: string) {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    rulesConsent.setValue((prev) => ({
      ...prev,
      [scope]: expiresAt,
    }));
  }

  function toggleDifficulty(difficulty: TaskDifficulty) {
    setSelectedDifficulties((prev) =>
      prev.includes(difficulty) ? prev.filter((item) => item !== difficulty) : [...prev, difficulty],
    );
  }

  async function handleStart() {
    setError(null);

    if (selectedDifficulties.length === 0) {
      setError("Selecione pelo menos um nivel de dificuldade.");
      return;
    }

    setLoading(true);

    try {
      const data = await createSimuladoQuestions({ count: 65, difficulties: selectedDifficulties });

      setQuestions(data.questions);
      setAnswers({});
      setCurrentIndex(0);
      setSubmitted(false);
      setResult(null);
      setReviewByQuestion({});
      setLoadingReviewByQuestion({});
      startSession(data.certificationCode, data.examMinutes ?? 90);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Erro ao iniciar simulado.");
    } finally {
      setLoading(false);
    }
  }

  async function handleStartWithRulesGate() {
    if (hasValidRulesConsent(consentScope)) {
      await handleStart();
      return;
    }

    setRulesAccepted(false);
    setShowRulesModal(true);
  }

  async function confirmRulesAndStart() {
    if (!rulesAccepted) {
      return;
    }

    persistRulesConsent(consentScope);
    setShowRulesModal(false);
    await handleStart();
  }

  async function fetchReviewForQuestion(question: StudyQuestion, selectedOption: QuestionOption) {
    if (reviewByQuestion[question.id] || loadingReviewByQuestion[question.id]) {
      return;
    }

    setLoadingReviewByQuestion((prev) => ({ ...prev, [question.id]: true }));

    try {
      const explanation = await createStudyExplanation({
        questionId: question.id,
        selectedOption,
        optionMapping: question.optionMapping,
      });

      setReviewByQuestion((prev) => ({
        ...prev,
        [question.id]: {
          summary: explanation.summary,
          options: explanation.options,
        },
      }));
    } catch {
      setReviewByQuestion((prev) => ({
        ...prev,
        [question.id]: {
          summary: "Revisao local baseada no gabarito da questao.",
          options: question.explanations,
        },
      }));
    } finally {
      setLoadingReviewByQuestion((prev) => ({ ...prev, [question.id]: false }));
    }
  }

  async function handleSubmitExam() {
    if (!session || questions.length === 0) {
      return;
    }

    const totalQuestions = questions.length;
    const correctAnswers = questions.filter((question) => answers[question.id] === question.correctOption).length;
    const scorePercent = Math.round((correctAnswers / totalQuestions) * 100);
    const difficultyWeight =
      selectedDifficulties.length === 0
        ? getTaskXpByDifficulty("medium")
        : Math.round(
            selectedDifficulties.reduce((sum, difficulty) => sum + getTaskXpByDifficulty(difficulty), 0) /
              selectedDifficulties.length,
          );
    const gainedXp = Math.max(30, Math.round(difficultyWeight / 4)) * correctAnswers;

    const totalDurationSeconds = Math.max(
      0,
      Math.floor((new Date(session.endsAt).getTime() - new Date(session.startedAt).getTime()) / 1000),
    );
    const usedDurationSeconds = Math.max(0, totalDurationSeconds - remainingSeconds);

    submitSession();
    clearSession();

    let historySaved = false;
    try {
      historySaved = await saveStudyHistory({
        sessionType: "SIMULADO",
        title: `Simulado ${session.certificationCode}`,
        certificationCode: session.certificationCode,
        gainedXp,
        scorePercent,
        correctAnswers,
        totalQuestions,
        durationSeconds: usedDurationSeconds,
        answersSnapshot: questions.map((question) => ({
          questionId: question.id,
          statement: question.statement,
          selectedOption: answers[question.id] ?? "-",
          correctOption: question.correctOption,
          options: question.options,
          optionMapping: question.optionMapping,
          explanations: {
            A: question.explanations.A ?? "Sem explicacao.",
            B: question.explanations.B ?? "Sem explicacao.",
            C: question.explanations.C ?? "Sem explicacao.",
            D: question.explanations.D ?? "Sem explicacao.",
            E: question.explanations.E ?? "Nao aplicavel.",
          },
        })),
      });
    } catch {
      historySaved = false;
    }

    setSubmitted(true);
    setCurrentIndex(0);
    setResult({
      certificationCode: session.certificationCode,
      correct: correctAnswers,
      total: totalQuestions,
      scorePercent,
      historySaved,
    });

    if (questions[0]) {
      await fetchReviewForQuestion(questions[0], answers[questions[0].id] ?? questions[0].correctOption);
    }
  }

  function handleForceExit() {
    clearSession();
    setQuestions([]);
    setAnswers({});
    setCurrentIndex(0);
    router.replace("/");
  }

  function handleReset() {
    setQuestions([]);
    setAnswers({});
    setCurrentIndex(0);
    setSubmitted(false);
    setResult(null);
    setReviewByQuestion({});
    setLoadingReviewByQuestion({});
    setError(null);
  }

  async function goToQuestion(index: number) {
    const clamped = Math.max(0, Math.min(questions.length - 1, index));
    setCurrentIndex(clamped);

    if (submitted) {
      const target = questions[clamped];
      if (target) {
        await fetchReviewForQuestion(target, answers[target.id] ?? target.correctOption);
      }
    }
  }

  if (!hydrated) {
    return (
      <AppLayout>
        <main className="flex min-h-[60vh] items-center justify-center">
          <p className="font-[var(--font-pixel)] text-xs uppercase text-[var(--pixel-subtext)]">Carregando...</p>
        </main>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 xl:px-8">
        <PixelCard>
          <h1 className="font-[var(--font-pixel)] text-sm uppercase text-[var(--pixel-primary)]">Modo Simulado AWS</h1>
          <p className="mt-2 font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
            Simulado aderente a sua certificacao alvo, com 65 questoes e cronometro de 90 minutos.
          </p>
        </PixelCard>

        {!inExamFlow && !inReviewFlow && (
          <PixelCard className="space-y-4">
            <h2 className="font-[var(--font-pixel)] text-xs uppercase text-[var(--pixel-primary)]">
              Configurar Simulado
            </h2>
            <p className="font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
              O filtro da certificacao e automatico pelo seu perfil. Selecione dificuldade e inicie a prova.
            </p>

            <div className="space-y-2">
              <p className="font-[var(--font-pixel)] text-[10px] uppercase text-[var(--pixel-subtext)]">Dificuldade</p>
              <div className="flex flex-wrap gap-2">
                {DIFFICULTIES.map((difficulty) => {
                  const selected = selectedDifficulties.includes(difficulty);
                  return (
                    <button
                      key={difficulty}
                      type="button"
                      onClick={() => toggleDifficulty(difficulty)}
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

            {error && <p className="font-[var(--font-body)] text-sm text-red-300">{error}</p>}

            <div className="flex justify-end">
              <PixelButton onClick={() => void handleStartWithRulesGate()} disabled={loading}>
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-3 w-3 animate-spin rounded-full border border-current border-r-transparent" />
                    Gerando Simulado...
                  </span>
                ) : (
                  "Iniciar Simulado (65 questoes)"
                )}
              </PixelButton>
            </div>
          </PixelCard>
        )}

        {showRulesModal && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4" role="dialog" aria-modal="true">
            <PixelCard className="w-full max-w-2xl space-y-4 border-yellow-500 bg-yellow-900/15">
              <p className="font-[var(--font-pixel)] text-[10px] uppercase text-yellow-300">Regras do Simulado</p>
              <h3 className="font-[var(--font-body)] text-xl">Ambiente de prova real</h3>

              <ul className="space-y-2 font-[var(--font-body)] text-sm text-[var(--pixel-text)]">
                <li>1. O simulado possui 65 questoes e cronometro ativo.</li>
                <li>2. Nao e permitido consultar materiais externos durante a prova.</li>
                <li>3. O objetivo e simular o ambiente real da certificacao AWS.</li>
                <li>4. Ao iniciar, mantenha foco continuo ate o envio final.</li>
              </ul>

              <label className="flex items-start gap-3 border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-3">
                <input
                  type="checkbox"
                  checked={rulesAccepted}
                  onChange={(event) => setRulesAccepted(event.target.checked)}
                  className="mt-1"
                />
                <span className="font-[var(--font-body)] text-sm">
                  Li e aceito as regras do simulado para reproduzir um ambiente real de prova.
                </span>
              </label>

              <div className="flex justify-end gap-2">
                <PixelButton variant="ghost" onClick={() => setShowRulesModal(false)}>
                  Cancelar
                </PixelButton>
                <PixelButton onClick={() => void confirmRulesAndStart()} disabled={!rulesAccepted || loading}>
                  Aceitar e iniciar simulado
                </PixelButton>
              </div>
            </PixelCard>
          </div>
        )}

        {(inExamFlow || inReviewFlow) && currentQuestion && (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <section className="space-y-4">
              {inExamFlow && (
                <PixelCard className="flex flex-wrap items-center justify-between gap-2 border-red-500 bg-red-900/10">
                  <p className="font-[var(--font-pixel)] text-[10px] uppercase text-red-300">
                    Prova em andamento · Certificacao {session?.certificationCode}
                  </p>
                  <div className="border-2 border-red-400 px-3 py-1 font-[var(--font-pixel)] text-sm text-red-300">
                    {timerLabel}
                  </div>
                </PixelCard>
              )}

              {inReviewFlow && result && (
                <PixelCard className="space-y-2 border-[var(--pixel-accent)] bg-[var(--pixel-accent)]/10">
                  <p className="font-[var(--font-pixel)] text-[10px] uppercase text-[var(--pixel-accent)]">
                    Resultado Final - {result.certificationCode}
                  </p>
                  <p className="font-[var(--font-body)] text-base">
                    Pontuacao: {result.scorePercent}% ({result.correct}/{result.total})
                  </p>
                  <p className="font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
                    {result.historySaved
                      ? "Resultado salvo no seu historico."
                      : "Resultado concluido, mas nao foi possivel salvar no historico."}
                  </p>
                </PixelCard>
              )}

              <PixelCard className="space-y-4">
                <p className="font-[var(--font-pixel)] text-[10px] uppercase text-[var(--pixel-subtext)]">
                  Questao {currentIndex + 1} de {questions.length} · {currentQuestion.topic} ·{" "}
                  {currentQuestion.difficulty}
                </p>
                <p className="font-[var(--font-body)] text-base">{currentQuestion.statement}</p>

                <div className="grid gap-2">
                  {OPTIONS.map((option) => {
                    const text = currentQuestion.options[option];
                    if (!text) return null;
                    const isReviewing = submitted;
                    const isCorrectOption = isReviewing && option === currentQuestion.correctOption;
                    const isSelectedWrong =
                      isReviewing && answers[currentQuestion.id] === option && option !== currentQuestion.correctOption;
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
                          checked={answers[currentQuestion.id] === option}
                          onChange={() =>
                            setAnswers((prev) => ({
                              ...prev,
                              [currentQuestion.id]: option,
                            }))
                          }
                          disabled={submitted}
                        />
                        <span className="font-[var(--font-body)] text-sm">
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
                    <PixelCard
                      className={
                        answers[currentQuestion.id] === currentQuestion.correctOption
                          ? "border-[#2ecc71] bg-green-900/25"
                          : "border-[#e74c3c] bg-red-900/25"
                      }
                    >
                      <p className="font-[var(--font-pixel)] text-[10px] uppercase">
                        {answers[currentQuestion.id] === currentQuestion.correctOption
                          ? "✓ Resposta correta"
                          : "✗ Resposta incorreta"}
                      </p>

                      {loadingReviewByQuestion[currentQuestion.id] && (
                        <p className="mt-2 font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">
                          <span className="inline-flex items-center gap-2">
                            <span className="h-3 w-3 animate-spin rounded-full border border-current border-r-transparent" />
                            Gerando revisao com IA...
                          </span>
                        </p>
                      )}

                      {currentReview && (
                        <p className="mt-2 font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
                          {currentReview.summary}
                        </p>
                      )}

                      <div className="mt-2 space-y-2">
                        {OPTIONS.map((option) => {
                          const text = currentQuestion.options[option];
                          if (!text) return null;

                          const isCorrectOption = option === currentQuestion.correctOption;
                          const isSelected = option === answers[currentQuestion.id];

                          return (
                            <div
                              key={`${currentQuestion.id}-review-${option}`}
                              className="border border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2"
                            >
                              <p className="font-[var(--font-pixel)] text-[9px] uppercase text-[var(--pixel-subtext)]">
                                {option}) {isCorrectOption ? "correta" : "incorreta"}
                                {isSelected ? " · sua resposta" : ""}
                              </p>
                              <p className="mt-1 font-[var(--font-body)] text-sm">
                                {currentReview?.options[option] ??
                                  currentQuestion.explanations[option] ??
                                  "Sem explicacao adicional."}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </PixelCard>
                  </motion.div>
                )}

                <div className="flex flex-wrap justify-between gap-2">
                  <div className="flex gap-2">
                    <PixelButton variant="ghost" onClick={() => void goToQuestion(currentIndex - 1)}>
                      Anterior
                    </PixelButton>
                    <PixelButton onClick={() => void goToQuestion(currentIndex + 1)}>Proxima</PixelButton>
                  </div>

                  <div className="flex gap-2">
                    {inExamFlow ? (
                      <>
                        <PixelButton variant="ghost" onClick={handleForceExit}>
                          Encerrar
                        </PixelButton>
                        <PixelButton onClick={handleSubmitExam}>Enviar Simulado</PixelButton>
                      </>
                    ) : (
                      <>
                        <PixelButton variant="ghost" onClick={() => router.replace("/")}>
                          Voltar ao inicio
                        </PixelButton>
                        <PixelButton onClick={handleReset}>Novo Simulado</PixelButton>
                      </>
                    )}
                  </div>
                </div>
              </PixelCard>
            </section>

            <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
              <PixelCard className="space-y-3">
                <p className="font-[var(--font-pixel)] text-[10px] uppercase text-[var(--pixel-subtext)]">
                  Navegacao da prova
                </p>
                <p className="font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
                  Respondidas: {answeredCount}/{questions.length}
                </p>
                <div className="grid grid-cols-5 gap-2">
                  {questions.map((question, index) => {
                    const answered = Boolean(answers[question.id]);
                    const isCurrent = index === currentIndex;
                    return (
                      <button
                        key={question.id}
                        type="button"
                        onClick={() => void goToQuestion(index)}
                        className={`border px-2 py-2 font-[var(--font-pixel)] text-[10px] uppercase ${
                          isCurrent
                            ? "border-[var(--pixel-primary)] bg-[var(--pixel-primary)]/20"
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
              </PixelCard>
            </aside>
          </div>
        )}

        {!isActive && questions.length > 0 && !submitted && (
          <PixelCard className="border-yellow-500 bg-yellow-900/20">
            <p className="font-[var(--font-body)] text-sm text-yellow-300">
              O tempo do simulado terminou ou a sessao foi encerrada. Envie ou reinicie para continuar.
            </p>
          </PixelCard>
        )}
      </main>
    </AppLayout>
  );
}
