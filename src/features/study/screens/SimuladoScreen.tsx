"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { PixelButton } from "@/components/ui/pixel-button";
import { PixelCard } from "@/components/ui/pixel-card";
import { STUDY_OPTIONS, StudyAnswerMap, StudyExplanationResult } from "@/features/study";
import {
  createSimuladoQuestions,
  createStudyExplanation,
  fetchSimuladoExamGuide,
  fetchWeakServices,
  isAnswerCorrect,
  normalizeAnswerValue,
  normalizeCorrectOptions,
  saveStudyHistory,
} from "@/features/study/services";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useSimulatedExam } from "@/hooks/useSimulatedExam";
import { useUserProfile } from "@/hooks/useUserProfile";
import { getTaskXpByDifficulty } from "@/lib/levels";
import { normalizeOptionText } from "@/lib/study-option-text";
import { STORAGE_KEYS } from "@/lib/storage";
import { QuestionOption, StudyQuestion, TaskDifficulty } from "@/lib/types";

const OPTIONS: QuestionOption[] = STUDY_OPTIONS;

function toggleMultiAnswer(current: QuestionOption[], option: QuestionOption): QuestionOption[] {
  if (current.includes(option)) {
    return current.filter((item) => item !== option).sort();
  }
  return [...current, option].sort();
}

type RulesConsentMap = Record<string, string>;

type WeakServiceMetric = {
  topic: string;
  attempts: number;
  errors: number;
  correct: number;
  errorRate: number;
};

type TopicPerformance = {
  topic: string;
  attempts: number;
  correct: number;
  wrong: number;
  accuracyPercent: number;
};

type ScoreOverviewData = {
  points: number;
  maxPoints: number;
  minimumCertificationPoints: number;
  bestArea: TopicPerformance | null;
  weakestArea: TopicPerformance | null;
};

function formatTime(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const mm = Math.floor(clamped / 60)
    .toString()
    .padStart(2, "0");
  const ss = (clamped % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

function formatGuideLines(text: string): string[] {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length >= 18)
    .slice(0, 10);
}

function buildTopicPerformance(questions: StudyQuestion[], answers: StudyAnswerMap): TopicPerformance[] {
  const byTopic = new Map<string, TopicPerformance>();

  for (const question of questions) {
    const topic = question.topic?.trim() || "OUTROS";
    const key = topic.toUpperCase();
    const current =
      byTopic.get(key) ??
      ({
        topic,
        attempts: 0,
        correct: 0,
        wrong: 0,
        accuracyPercent: 0,
      } satisfies TopicPerformance);

    current.attempts += 1;
    const correct = isAnswerCorrect({
      questionType: question.questionType,
      answer: answers[question.id],
      correctOption: question.correctOption,
      correctOptions: question.correctOptions,
    });

    if (correct) {
      current.correct += 1;
    } else {
      current.wrong += 1;
    }

    byTopic.set(key, current);
  }

  return Array.from(byTopic.values())
    .map((item) => ({
      ...item,
      accuracyPercent: item.attempts > 0 ? Math.round((item.correct / item.attempts) * 100) : 0,
    }))
    .sort((a, b) => b.accuracyPercent - a.accuracyPercent || b.correct - a.correct || b.attempts - a.attempts);
}

function buildScoreOverview(correct: number, total: number, topicPerformance: TopicPerformance[]): ScoreOverviewData {
  const maxPoints = 1000;
  const minimumCertificationPoints = 700;
  const points = total > 0 ? Math.round((correct / total) * maxPoints) : 0;

  const bestArea = topicPerformance.length > 0 ? topicPerformance[0] : null;
  const weakestArea =
    topicPerformance.length > 0 ? [...topicPerformance].sort((a, b) => a.accuracyPercent - b.accuracyPercent)[0] : null;

  return {
    points,
    maxPoints,
    minimumCertificationPoints,
    bestArea,
    weakestArea,
  };
}

export function SimuladoScreen() {
  const router = useRouter();
  const { hydrated, isActive, remainingSeconds, session, startSession, submitSession, clearSession } =
    useSimulatedExam();
  const { profile, refreshTotalXp } = useUserProfile();
  const rulesConsent = useLocalStorage<RulesConsentMap>(STORAGE_KEYS.simuladoRulesConsent, {});

  const [questions, setQuestions] = useState<StudyQuestion[]>([]);
  const [answers, setAnswers] = useState<StudyAnswerMap>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [reviewByQuestion, setReviewByQuestion] = useState<Record<string, StudyExplanationResult>>({});
  const [loadingReviewByQuestion, setLoadingReviewByQuestion] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const [showRulesModal, setShowRulesModal] = useState(false);
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [showExamGuidePanel, setShowExamGuidePanel] = useState(true);
  const [examGuideInfo, setExamGuideInfo] = useState<{
    markdown: string;
    preview: string;
    highlights: string[];
    totalChars: number;
  } | null>(null);
  const [loadingExamGuide, setLoadingExamGuide] = useState(false);
  const [examGuideError, setExamGuideError] = useState<string | null>(null);
  const [historicalWeakServices, setHistoricalWeakServices] = useState<WeakServiceMetric[]>([]);
  const [loadingWeakServices, setLoadingWeakServices] = useState(false);
  const [scoreOverview, setScoreOverview] = useState<ScoreOverviewData | null>(null);
  const [showScoreOverview, setShowScoreOverview] = useState(false);
  const [mockScoreOverview, setMockScoreOverview] = useState<ScoreOverviewData | null>(null);

  const inExamFlow = isActive && questions.length > 0 && !submitted;
  const inReviewFlow = submitted && questions.length > 0;
  const currentQuestion = questions[currentIndex] ?? null;
  const answeredCount = useMemo(
    () => questions.filter((question) => normalizeAnswerValue(answers[question.id]).length > 0).length,
    [answers, questions],
  );
  const timerLabel = useMemo(() => formatTime(remainingSeconds), [remainingSeconds]);
  const weakServicesCurrentExam = useMemo<WeakServiceMetric[]>(() => {
    if (questions.length === 0) {
      return [];
    }

    const byTopic = new Map<string, WeakServiceMetric>();
    for (const question of questions) {
      const topic = question.topic?.trim() || "OUTROS";
      const key = topic.toUpperCase();
      const selectedAnswer = answers[question.id];
      const current =
        byTopic.get(key) ??
        ({
          topic,
          attempts: 0,
          errors: 0,
          correct: 0,
          errorRate: 0,
        } as WeakServiceMetric);

      current.attempts += 1;
      if (
        isAnswerCorrect({
          questionType: question.questionType,
          answer: selectedAnswer,
          correctOption: question.correctOption,
          correctOptions: question.correctOptions,
        })
      ) {
        current.correct += 1;
      } else {
        current.errors += 1;
      }

      byTopic.set(key, current);
    }

    return Array.from(byTopic.values())
      .map((item) => ({
        ...item,
        errorRate: item.attempts > 0 ? Math.round((item.errors / item.attempts) * 100) : 0,
      }))
      .filter((item) => item.errors > 0)
      .sort((a, b) => {
        if (b.errorRate !== a.errorRate) {
          return b.errorRate - a.errorRate;
        }
        if (b.errors !== a.errors) {
          return b.errors - a.errors;
        }
        return b.attempts - a.attempts;
      });
  }, [answers, questions]);

  const currentReview = currentQuestion ? reviewByQuestion[currentQuestion.id] : undefined;
  const consentScope = profile.certificationPresetCode?.trim() || "default";
  const guidePreviewLines = useMemo(() => formatGuideLines(examGuideInfo?.preview ?? ""), [examGuideInfo?.preview]);
  const strongestGapTopics = useMemo(() => {
    const source = historicalWeakServices.length > 0 ? historicalWeakServices : weakServicesCurrentExam;
    return source
      .map((item) => item.topic.trim())
      .filter(Boolean)
      .slice(0, 3);
  }, [historicalWeakServices, weakServicesCurrentExam]);
  const allQuestionsAnswered = answeredCount === questions.length && questions.length > 0;
  const activeOverview = showScoreOverview ? (mockScoreOverview ?? scoreOverview) : null;
  const activeOverviewProgress = activeOverview
    ? Math.min(1, Math.max(0, activeOverview.points / activeOverview.maxPoints))
    : 0;
  const activeOverviewThresholdProgress = activeOverview
    ? Math.min(1, Math.max(0, activeOverview.minimumCertificationPoints / activeOverview.maxPoints))
    : 0;
  const gaugeCenterX = 160;
  const gaugeCenterY = 160;
  const gaugeRadius = 120;
  const gaugeNeedleRadius = 96;
  const activeOverviewNeedleRadians = Math.PI * (1 - activeOverviewProgress);
  const activeOverviewThresholdRadians = Math.PI * (1 - activeOverviewThresholdProgress);
  const activeOverviewNeedleX = gaugeCenterX + Math.cos(activeOverviewNeedleRadians) * gaugeNeedleRadius;
  const activeOverviewNeedleY = gaugeCenterY - Math.sin(activeOverviewNeedleRadians) * gaugeNeedleRadius;
  const activeOverviewThresholdX = gaugeCenterX + Math.cos(activeOverviewThresholdRadians) * gaugeRadius;
  const activeOverviewThresholdY = gaugeCenterY - Math.sin(activeOverviewThresholdRadians) * gaugeRadius;

  function toTopicCode(topic: string): string {
    const cleaned = topic
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .trim();
    return cleaned || topic.toUpperCase();
  }

  function buildGapLabSeed(topics: string[]): string {
    const heading = `Revisao focada nos gaps do simulado (${session?.certificationCode ?? "AWS"})`;
    const bullets = topics.map((topic, index) => `${index + 1}. ${topic}`).join("\n");
    return [
      heading,
      "",
      "Objetivo:",
      "Criar um laboratorio unico para reforcar os topicos abaixo com tarefas praticas e verificaveis:",
      bullets,
      "",
      "Requisitos:",
      "- Incluir comandos/acoes em AWS Console e/ou CLI",
      "- Incluir checkpoints de validacao por topico",
      "- Finalizar com checklist de consolidacao",
    ].join("\n");
  }

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

  useEffect(() => {
    if (!hydrated || inExamFlow || inReviewFlow) {
      return;
    }

    let cancelled = false;

    async function loadExamGuide() {
      setLoadingExamGuide(true);
      setExamGuideError(null);

      try {
        const payload = await fetchSimuladoExamGuide();
        if (!cancelled) {
          setExamGuideInfo(payload.examGuide);
        }
      } catch (requestError) {
        if (!cancelled) {
          setExamGuideInfo(null);
          setExamGuideError(
            requestError instanceof Error ? requestError.message : "Nao foi possivel carregar o Exam Guide.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingExamGuide(false);
        }
      }
    }

    void loadExamGuide();

    return () => {
      cancelled = true;
    };
  }, [hydrated, inExamFlow, inReviewFlow, consentScope]);

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

  async function handleStart() {
    setError(null);
    setHistoricalWeakServices([]);

    setLoading(true);

    try {
      const data = await createSimuladoQuestions({ count: 65, difficulties: ["easy", "medium", "hard"] });
      setQuestions(data.questions);
      setAnswers({});
      setCurrentIndex(0);
      setSubmitted(false);
      setReviewByQuestion({});
      setLoadingReviewByQuestion({});
      setExamGuideInfo(data.examGuide ?? null);
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

  async function fetchReviewForQuestion(question: StudyQuestion, answer: StudyAnswerMap[string]) {
    if (reviewByQuestion[question.id] || loadingReviewByQuestion[question.id]) {
      return;
    }

    const normalized = normalizeAnswerValue(answer);

    setLoadingReviewByQuestion((prev) => ({ ...prev, [question.id]: true }));

    try {
      const explanation = await createStudyExplanation({
        questionId: question.id,
        selectedOption: normalized[0] ?? question.correctOption,
        selectedOptions: question.questionType === "multi" ? normalized : undefined,
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
    const correctAnswers = questions.filter((question) => {
      return isAnswerCorrect({
        questionType: question.questionType,
        answer: answers[question.id],
        correctOption: question.correctOption,
        correctOptions: question.correctOptions,
      });
    }).length;
    const scorePercent = Math.round((correctAnswers / totalQuestions) * 100);
    const difficultyWeight = Math.round(
      ["easy", "medium", "hard"].reduce(
        (sum, difficulty) => sum + getTaskXpByDifficulty(difficulty as TaskDifficulty),
        0,
      ) / ["easy", "medium", "hard"].length,
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
          questionType: question.questionType,
          selectedOption: normalizeAnswerValue(answers[question.id])[0] ?? "-",
          selectedOptions: normalizeAnswerValue(answers[question.id]),
          correctOption: question.correctOption,
          correctOptions: normalizeCorrectOptions(question),
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

      if (historySaved) {
        await refreshTotalXp();
      }
    } catch {
      historySaved = false;
    }

    setSubmitted(true);
    setCurrentIndex(0);
    const performance = buildTopicPerformance(questions, answers);
    setScoreOverview(buildScoreOverview(correctAnswers, totalQuestions, performance));
    setShowScoreOverview(true);

    setLoadingWeakServices(true);
    try {
      const weakServices = await fetchWeakServices({ take: 5, sample: 35 });
      setHistoricalWeakServices(
        weakServices.map((item) => ({
          topic: item.serviceCode || item.topic,
          attempts: item.attempts,
          errors: item.errors,
          correct: item.correct,
          errorRate: item.errorRate,
        })),
      );
    } catch {
      setHistoricalWeakServices([]);
    } finally {
      setLoadingWeakServices(false);
    }

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
    setReviewByQuestion({});
    setLoadingReviewByQuestion({});
    setExamGuideInfo(null);
    setHistoricalWeakServices([]);
    setLoadingWeakServices(false);
    setScoreOverview(null);
    setShowScoreOverview(false);
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
      <main className="flex min-h-[60vh] items-center justify-center">
        <p className="font-mono text-xs uppercase text-[var(--pixel-subtext)]">Carregando...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 xl:px-8">
      {process.env.NODE_ENV !== "production" && !inExamFlow && !inReviewFlow && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              setMockScoreOverview({
                points: 742,
                maxPoints: 1000,
                minimumCertificationPoints: 700,
                bestArea: {
                  topic: "IAM",
                  attempts: 12,
                  correct: 10,
                  wrong: 2,
                  accuracyPercent: 83,
                },
                weakestArea: {
                  topic: "Billing and Pricing",
                  attempts: 8,
                  correct: 3,
                  wrong: 5,
                  accuracyPercent: 38,
                },
              });
              setShowScoreOverview(true);
            }}
            className="border border-[#334155] px-3 py-2 text-xs uppercase text-[#cbd5e1]"
          >
            Visualizar score mock (dev)
          </button>
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        <PixelCard>
          <h1 className="font-mono text-sm uppercase text-[var(--pixel-primary)]">Modo Simulado AWS</h1>
          <p className="mt-2 font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
            Simulado aderente a sua certificacao alvo, com 65 questoes e cronometro de 90 minutos.
          </p>
        </PixelCard>
      </motion.div>

      {activeOverview && (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <PixelCard className="space-y-5 border-[var(--pixel-accent)] bg-[var(--pixel-card)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[10px] uppercase text-[var(--pixel-accent)]">Score do Simulado</p>
                <h2 className="mt-1 font-sans text-2xl">Overview de Desempenho</h2>
              </div>
              {process.env.NODE_ENV !== "production" && (
                <button
                  type="button"
                  onClick={() => setShowScoreOverview(false)}
                  className="border border-[var(--pixel-border)] px-3 py-2 text-[10px] uppercase"
                >
                  Ocultar overview
                </button>
              )}
            </div>

            <div className="border border-[var(--pixel-border)] bg-[repeating-linear-gradient(45deg,rgba(148,163,184,0.07),rgba(148,163,184,0.07)_8px,rgba(15,23,42,0.22)_8px,rgba(15,23,42,0.22)_16px)] p-3 sm:p-4">
              <div className="mx-auto w-full max-w-[34rem] overflow-hidden">
                <div className="relative">
                  <svg viewBox="0 0 320 210" className="w-full h-auto" role="img" aria-label="Velocimetro de pontuacao">
                    <defs>
                      <linearGradient id="retroGaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#b91c1c" />
                        <stop offset="40%" stopColor="#f59e0b" />
                        <stop offset="72%" stopColor="#84cc16" />
                        <stop offset="100%" stopColor="#22c55e" />
                      </linearGradient>
                    </defs>

                    <path
                      d="M 40 160 A 120 120 0 0 1 280 160"
                      stroke="rgba(148,163,184,0.2)"
                      strokeWidth="26"
                      fill="none"
                    />
                    <path
                      d="M 40 160 A 120 120 0 0 1 280 160"
                      stroke="url(#retroGaugeGradient)"
                      strokeWidth="20"
                      fill="none"
                    />

                    <line
                      x1={gaugeCenterX}
                      y1={gaugeCenterY}
                      x2={activeOverviewThresholdX}
                      y2={activeOverviewThresholdY}
                      stroke="#fca5a5"
                      strokeWidth="2"
                      strokeDasharray="4 4"
                    />

                    <line
                      x1={gaugeCenterX}
                      y1={gaugeCenterY}
                      x2={activeOverviewNeedleX}
                      y2={activeOverviewNeedleY}
                      stroke="#f8fafc"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                    <circle cx={gaugeCenterX} cy={gaugeCenterY} r="8" fill="#e2e8f0" stroke="#0f172a" strokeWidth="2" />

                    <text
                      x="40"
                      y="184"
                      textAnchor="middle"
                      className="fill-[var(--pixel-subtext)] text-[10px] font-mono"
                    >
                      0
                    </text>
                    <text
                      x="280"
                      y="184"
                      textAnchor="middle"
                      className="fill-[var(--pixel-subtext)] text-[10px] font-mono"
                    >
                      {activeOverview.maxPoints}
                    </text>
                    <text
                      x={activeOverviewThresholdX}
                      y={activeOverviewThresholdY - 8}
                      textAnchor="middle"
                      className="fill-red-300 text-[10px] font-mono"
                    >
                      {activeOverview.minimumCertificationPoints}
                    </text>
                  </svg>

                  <div className="pointer-events-none absolute inset-x-0 bottom-1 text-center">
                    <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Pontuacao</p>
                    <p className="font-mono text-xl sm:text-2xl text-[var(--pixel-text)]">
                      {activeOverview.points}
                      <span className="text-xs sm:text-sm text-[var(--pixel-subtext)]">
                        {" "}
                        / {activeOverview.maxPoints}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-center font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
                Corte de certificacao marcado em vermelho: {activeOverview.minimumCertificationPoints} pontos.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="border border-[#14532d] bg-green-900/20 p-3">
                <p className="font-mono text-[10px] uppercase text-green-300">Area com maior acerto</p>
                <p className="mt-1 font-[var(--font-body)] text-sm text-[var(--pixel-text)]">
                  {activeOverview.bestArea?.topic ?? "Sem dados"}
                </p>
                {activeOverview.bestArea && (
                  <p className="font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">
                    {activeOverview.bestArea.correct}/{activeOverview.bestArea.attempts} corretas (
                    {activeOverview.bestArea.accuracyPercent}%)
                  </p>
                )}
              </div>

              <div className="border border-[#7f1d1d] bg-red-900/20 p-3">
                <p className="font-mono text-[10px] uppercase text-red-300">Area com menor acerto</p>
                <p className="mt-1 font-[var(--font-body)] text-sm text-[var(--pixel-text)]">
                  {activeOverview.weakestArea?.topic ?? "Sem dados"}
                </p>
                {activeOverview.weakestArea && (
                  <p className="font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">
                    {activeOverview.weakestArea.correct}/{activeOverview.weakestArea.attempts} corretas (
                    {activeOverview.weakestArea.accuracyPercent}%)
                  </p>
                )}
              </div>
            </div>
          </PixelCard>
        </motion.div>
      )}
      {!inExamFlow && !inReviewFlow && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut", delay: 0.05 }}
        >
          <PixelCard className="space-y-4">
            <h2 className="font-mono text-xs uppercase text-[var(--pixel-primary)]">Configurar Simulado</h2>
            <p className="font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
              O filtro da certificacao e automatico pelo seu perfil. Selecione dificuldade e inicie a prova.
            </p>

            <div className="grid gap-3 md:grid-cols-3">
              {[
                {
                  title: "Formato oficial",
                  description: "65 questoes com tempo controlado para simular a pressao real da certificacao.",
                },
                {
                  title: "Correcao orientada",
                  description: "Ao finalizar, voce recebe score, revisao por questao e pontos fracos por topico.",
                },
                {
                  title: "Treino progressivo",
                  description:
                    "Seu historico alimenta priorizacao de revisao para melhorar desempenho nas proximas provas.",
                },
              ].map((item, index) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: 0.06 * index }}
                  className="border border-[var(--pixel-border)] bg-[var(--pixel-bg)] p-3"
                >
                  <p className="font-mono text-[10px] uppercase text-[var(--pixel-primary)]">{item.title}</p>
                  <p className="mt-1 font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">{item.description}</p>
                </motion.div>
              ))}
            </div>

            {loadingExamGuide && (
              <p className="font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">Carregando Exam Guide...</p>
            )}

            {examGuideError && !loadingExamGuide && (
              <p className="font-[var(--font-body)] text-xs text-yellow-300">{examGuideError}</p>
            )}

            {examGuideInfo && (
              <div className="space-y-3 border border-[var(--pixel-border)] bg-[var(--pixel-bg)] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-mono text-[10px] uppercase text-[var(--pixel-accent)]">
                    Exame guide ativo da certificacao
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowExamGuidePanel((prev) => !prev)}
                    className="border border-[var(--pixel-border)] px-2 py-1 font-mono text-[10px] uppercase"
                  >
                    {showExamGuidePanel ? "Ocultar detalhes" : "Mostrar detalhes"}
                  </button>
                </div>

                <p className="font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">
                  Este simulado foi alinhado ao guia oficial definido pelo admin ({examGuideInfo.totalChars}{" "}
                  caracteres).
                </p>

                <AnimatePresence initial={false}>
                  {showExamGuidePanel && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                      className="space-y-2 overflow-hidden"
                    >
                      {examGuideInfo.highlights.length > 0 && (
                        <div className="space-y-1">
                          <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Topicos de foco</p>
                          {examGuideInfo.highlights.map((item) => (
                            <ReactMarkdown
                              key={item}
                              remarkPlugins={[remarkGfm]}
                              components={{
                                strong: ({ children }) => (
                                  <h3 className="mb-1 mt-2 text-[0.7rem] uppercase text-[var(--pixel-subtext)]">
                                    {children}
                                  </h3>
                                ),
                              }}
                            >
                              {item}
                            </ReactMarkdown>
                          ))}
                        </div>
                      )}

                      <div className="space-y-1 border border-[var(--pixel-border)] bg-black/10 p-2">
                        <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Exam guide</p>
                        {examGuideInfo.markdown.trim().length > 0 ? (
                          <div className="max-h-[40rem] overflow-auto rounded border border-[var(--pixel-border)] bg-[var(--pixel-card)] p-3">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                h1: ({ children }) => (
                                  <h1 className="mb-2 font-mono text-sm uppercase text-primary">{children}</h1>
                                ),
                                h2: ({ children }) => (
                                  <h2 className="mb-2 mt-3 font-mono text-xs uppercase text-accent">{children}</h2>
                                ),
                                h3: ({ children }) => (
                                  <h3 className="mb-1 mt-2 font-mono text-[11px] uppercase text-[var(--pixel-subtext)]">
                                    {children}
                                  </h3>
                                ),
                                p: ({ children }) => (
                                  <p className="mb-2 font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">
                                    {children}
                                  </p>
                                ),
                                li: ({ children }) => (
                                  <li className="mb-1 ml-4 list-disc font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">
                                    {children}
                                  </li>
                                ),
                                table: ({ children }) => (
                                  <table className="mb-2 w-full border-collapse text-xs">{children}</table>
                                ),
                                th: ({ children }) => (
                                  <th className="border border-[var(--pixel-border)] px-2 py-1 text-left font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">
                                    {children}
                                  </th>
                                ),
                                td: ({ children }) => (
                                  <td className="border border-[var(--pixel-border)] px-2 py-1 font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">
                                    {children}
                                  </td>
                                ),
                              }}
                            >
                              {examGuideInfo.markdown}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <>
                            {guidePreviewLines.length > 0 ? (
                              guidePreviewLines.map((line) => (
                                <p key={line} className="font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">
                                  {line}
                                </p>
                              ))
                            ) : (
                              <p className="font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">
                                Sem trecho disponivel no momento.
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

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
        </motion.div>
      )}

      {showRulesModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4" role="dialog" aria-modal="true">
          <PixelCard className="w-full max-w-2xl space-y-4 border-yellow-500 bg-yellow-900/95">
            <p className="font-mono text-[10px] uppercase text-yellow-300">Regras do Simulado</p>
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
                <p className="font-mono text-[10px] uppercase text-red-300">
                  Prova em andamento · Certificacao {session?.certificationCode}
                </p>
                <div className="border-2 border-red-400 px-3 py-1 font-mono text-sm text-red-300">{timerLabel}</div>
              </PixelCard>
            )}

            <motion.div
              key={currentQuestion.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              <PixelCard className="space-y-4">
                <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">
                  Questao {currentIndex + 1} de {questions.length}
                </p>
                <p className="font-[var(--font-body)] text-base">{currentQuestion.statement}</p>
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
                                currentQuestion.questionType === "multi" ? toggleMultiAnswer(current, option) : option;

                              return {
                                ...prev,
                                [currentQuestion.id]: nextValue,
                              };
                            });
                          }}
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
                        isAnswerCorrect({
                          questionType: currentQuestion.questionType,
                          answer: answers[currentQuestion.id],
                          correctOption: currentQuestion.correctOption,
                          correctOptions: currentQuestion.correctOptions,
                        })
                          ? "border-[#2ecc71] bg-green-900/25"
                          : "border-[#e74c3c] bg-red-900/25"
                      }
                    >
                      <p className="font-mono text-[10px] uppercase">
                        {isAnswerCorrect({
                          questionType: currentQuestion.questionType,
                          answer: answers[currentQuestion.id],
                          correctOption: currentQuestion.correctOption,
                          correctOptions: currentQuestion.correctOptions,
                        })
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
                          const text = normalizeOptionText(currentQuestion.options[option]);
                          if (!text) return null;

                          const isCorrectOption = normalizeCorrectOptions(currentQuestion).includes(option);
                          const isSelected = normalizeAnswerValue(answers[currentQuestion.id]).includes(option);

                          return (
                            <div
                              key={`${currentQuestion.id}-review-${option}`}
                              className="border border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2"
                            >
                              <p className="font-mono text-[9px] uppercase text-[var(--pixel-subtext)]">
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
                        {allQuestionsAnswered ? (
                          <PixelButton onClick={handleSubmitExam}>Enviar Simulado</PixelButton>
                        ) : (
                          <p className="self-center font-[var(--font-body)] text-xs text-yellow-300">
                            Responda todas as {questions.length} questoes para enviar o simulado.
                          </p>
                        )}
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
            </motion.div>
          </section>

          <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
            <PixelCard className="space-y-3">
              <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Navegacao da prova</p>
              <p className="font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
                Respondidas: {answeredCount}/{questions.length}
              </p>
              <div className="grid grid-cols-5 gap-2">
                {questions.map((question, index) => {
                  const answered = normalizeAnswerValue(answers[question.id]).length > 0;
                  const isCurrent = index === currentIndex;
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
                      className={`border px-2 py-2 font-mono text-[10px] uppercase ${
                        isCurrent
                          ? "border-[var(--pixel-primary)] bg-[var(--pixel-primary)]/20"
                          : submitted
                            ? isCorrectAfterSubmit
                              ? "border-[#2ecc71] bg-green-900/15"
                              : "border-[#e74c3c] bg-red-900/20"
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

            {inReviewFlow && (
              <PixelCard className="space-y-3 border-[var(--pixel-accent)] bg-[var(--pixel-accent)]/10">
                <p className="font-mono text-[10px] uppercase text-[var(--pixel-accent)]">Prioridades de revisao</p>
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

                {!loadingWeakServices && historicalWeakServices.length === 0 && weakServicesCurrentExam.length > 0 && (
                  <div className="space-y-2">
                    {weakServicesCurrentExam.slice(0, 5).map((item) => (
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
                      <PixelButton
                        onClick={() =>
                          router.push(`/kc?topics=${encodeURIComponent(strongestGapTopics.map(toTopicCode).join(","))}`)
                        }
                      >
                        Fazer KC dos gaps
                      </PixelButton>
                      <PixelButton
                        variant="ghost"
                        onClick={() =>
                          router.push(
                            `/lab?focus=${encodeURIComponent(strongestGapTopics.join(", "))}&labText=${encodeURIComponent(
                              buildGapLabSeed(strongestGapTopics),
                            )}`,
                          )
                        }
                      >
                        Criar Lab unico dos gaps
                      </PixelButton>
                    </div>
                  </div>
                )}
              </PixelCard>
            )}
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
  );
}
