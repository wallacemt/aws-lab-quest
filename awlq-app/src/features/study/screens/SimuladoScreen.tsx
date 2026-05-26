"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { PixelCard } from "@/components/ui/pixel-card";
import { STUDY_OPTIONS, StudyAnswerMap, StudyExplanationResult } from "@/features/study";
import { SimuladoExamFlow } from "@/features/study/components/simulado/SimuladoExamFlow";
import { SimuladoExamGuide } from "@/features/study/components/simulado/SimuladoExamGuide";
import { SimuladoPacksGrid } from "@/features/study/components/simulado/SimuladoPacksGrid";
import { SimuladoResultOverview } from "@/features/study/components/simulado/SimuladoResultOverview";
import { SimuladoResumeModal } from "@/features/study/components/simulado/SimuladoResumeModal";
import { SimuladoRulesModal } from "@/features/study/components/simulado/SimuladoRulesModal";
import { SimuladoContext } from "@/features/study/context/SimuladoContext";
import type { WeakServiceMetric } from "@/features/study/context/SimuladoContext";
import {
  createSimuladoQuestions,
  createSimuladoQuestionsFromPack,
  createStudyExplanation,
  fetchSimuladoExamGuide,
  fetchWeakServices,
  isAnswerCorrect,
  normalizeAnswerValue,
  normalizeCorrectOptions,
  reportStudyQuestion,
  saveStudyHistory,
  saveStudyHistoryExplanation,
} from "@/features/study/services";
import { useProgressNotifications } from "@/features/study/components/notifications/useProgressNotifications";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useSimulatedExam } from "@/hooks/useSimulatedExam";
import { useUserProfile } from "@/hooks/useUserProfile";
import { getTaskXpByDifficulty } from "@/lib/levels";
import { normalizeOptionText } from "@/lib/study-option-text";
import { STORAGE_KEYS, safeLocalStorageGet, safeLocalStorageRemove, safeLocalStorageSet } from "@/lib/storage";
import { QuestionOption, SimuladoDraft, StudyQuestion, TaskDifficulty } from "@/lib/types";
import { TooltipProvider } from "@/components/ui/tooltip";

const OPTIONS: QuestionOption[] = STUDY_OPTIONS;
const GAP_TOP_N = 10;

type RulesConsentMap = Record<string, string>;

type SimuladoPackListItem = {
  id: string;
  name: string;
  questionCount: number;
  artworkUrl: string | null;
  difficultyScore: number;
  createdAt: string;
  attempts: number;
  bestScore: number | null;
  lastSessionId: string | null;
  sessions: {
    id: string;
    scorePercent: number;
    correctAnswers: number;
    totalQuestions: number;
    completedAt: string;
  }[];
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

function playAlarmBeep() {
  try {
    const ctx = new AudioContext();
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.4, ctx.currentTime + i * 0.35);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.35 + 0.3);
      osc.start(ctx.currentTime + i * 0.35);
      osc.stop(ctx.currentTime + i * 0.35 + 0.3);
    }
  } catch {
    // Web Audio API não disponível
  }
}

function playSuccessSound() {
  try {
    const ctx = new AudioContext();
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.25);
      osc.start(ctx.currentTime + i * 0.18);
      osc.stop(ctx.currentTime + i * 0.18 + 0.25);
    });
  } catch {
    // Web Audio API não disponível
  }
}

async function triggerConfetti() {
  try {
    const confetti = (await import("canvas-confetti")).default;
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, zIndex: 9999 });
    setTimeout(() => confetti({ particleCount: 60, spread: 120, origin: { x: 0.1, y: 0.5 }, zIndex: 9999 }), 300);
    setTimeout(() => confetti({ particleCount: 60, spread: 120, origin: { x: 0.9, y: 0.5 }, zIndex: 9999 }), 500);
  } catch {
    // canvas-confetti não disponível
  }
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
  const {
    hydrated,
    isActive,
    isPaused,
    remainingSeconds,
    session,
    startSession,
    submitSession,
    clearSession,
    pauseSession,
    resumeSession,
  } = useSimulatedExam();
  const { profile, refreshTotalXp } = useUserProfile();
  const notifyProgress = useProgressNotifications();
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
  const [savedHistoryId, setSavedHistoryId] = useState<string | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportMessage, setReportMessage] = useState<string | null>(null);
  const [markedForReview, setMarkedForReview] = useState<Set<string>>(new Set());
  const [showPreSubmitSummary, setShowPreSubmitSummary] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [motivationalMessage, setMotivationalMessage] = useState<string | null>(null);
  const [loadingMotivationalMessage, setLoadingMotivationalMessage] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [resumeDraft, setResumeDraft] = useState<SimuladoDraft | null>(null);

  const [activeTab, setActiveTab] = useState<"examGuide" | "simulados">("simulados");
  const [packs, setPacks] = useState<SimuladoPackListItem[]>([]);
  const [packsLoading, setPacksLoading] = useState(false);
  const [packsFilter, setPacksFilter] = useState<"all" | "todo" | "done">("all");
  const [packsDifficultyFilter, setPacksDifficultyFilter] = useState<"all" | "easy" | "medium" | "hard" | "boss">(
    "all",
  );
  const [packsRefreshKey, setPacksRefreshKey] = useState(0);
  const [packsSearch, setPacksSearch] = useState("");
  const [packsSort, setPacksSort] = useState<"newest" | "oldest" | "name_az" | "score_desc">("newest");
  const { value: packsView, setValue: setPacksView } = useLocalStorage<"grid" | "list">(
    STORAGE_KEYS.simuladoPacksView,
    "grid",
  );
  const [certInfo, setCertInfo] = useState<{ code: string; name: string } | null>(null);
  const [pendingPackId, setPendingPackId] = useState<string | null>(null);
  const [pendingPackName, setPendingPackName] = useState<string | null>(null);
  const [currentPackId, setCurrentPackId] = useState<string | null>(null);
  const [expandedPackHistory, setExpandedPackHistory] = useState<string | null>(null);

  const confettiFiredRef = useRef(false);
  const prevRemainingRef = useRef(remainingSeconds);

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

  const strongestGapTopics = useMemo(() => {
    const source = historicalWeakServices.length > 0 ? historicalWeakServices : weakServicesCurrentExam;
    return source
      .map((item) => item.topic.trim())
      .filter(Boolean)
      .slice(0, 3);
  }, [historicalWeakServices, weakServicesCurrentExam]);
  const allQuestionsAnswered = answeredCount === questions.length && questions.length > 0;
  const activeOverview = showScoreOverview ? (mockScoreOverview ?? scoreOverview) : null;
  const currentReviewOptions = useMemo(() => {
    if (!currentQuestion) {
      return [];
    }

    const selectedOptions = normalizeAnswerValue(answers[currentQuestion.id]);
    const correctOptions = normalizeCorrectOptions(currentQuestion);

    return OPTIONS.map((option) => {
      const text = normalizeOptionText(currentQuestion.options[option]);
      if (!text) {
        return null;
      }

      return {
        option,
        text,
        explanation:
          currentReview?.options[option] ?? currentQuestion.explanations[option] ?? "Sem explicacao adicional.",
        isCorrect: correctOptions.includes(option),
        isSelected: selectedOptions.includes(option),
      };
    }).filter((item): item is NonNullable<typeof item> => item !== null);
  }, [answers, currentQuestion, currentReview]);

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
    if (!hydrated) return;

    if (isActive && questions.length === 0 && !submitted && !loading) {
      const draft = safeLocalStorageGet<SimuladoDraft | null>(STORAGE_KEYS.simuladoDraft, null);
      if (draft && session && draft.sessionId === session.id && draft.questions.length > 0) {
        setResumeDraft(draft);
        setShowResumeModal(true);
        return;
      }
      clearSession();
      setError("Sessao anterior de simulado expirada ou incompleta. Inicie um novo simulado para continuar.");
    }
  }, [clearSession, hydrated, isActive, loading, questions.length, session, submitted]);

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

  useEffect(() => {
    if (!hydrated || inExamFlow || inReviewFlow) return;
    let cancelled = false;

    async function loadPacks() {
      setPacksLoading(true);
      try {
        const res = await fetch(`/api/study/simulado-packs?filter=${packsFilter}`);
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as {
          packs: SimuladoPackListItem[];
          certificationCode: string | null;
          certificationName: string | null;
        };
        if (!cancelled) {
          setPacks(json.packs ?? []);
          if (json.certificationCode) {
            setCertInfo({ code: json.certificationCode, name: json.certificationName ?? json.certificationCode });
          }
        }
      } catch {
        // non-fatal
      } finally {
        if (!cancelled) setPacksLoading(false);
      }
    }

    void loadPacks();
    return () => {
      cancelled = true;
    };
  }, [hydrated, inExamFlow, inReviewFlow, packsFilter, packsRefreshKey]);

  useEffect(() => {
    if (prevRemainingRef.current > 0 && remainingSeconds <= 0 && inExamFlow) {
      playAlarmBeep();
      void handleSubmitExam();
    }
    prevRemainingRef.current = remainingSeconds;
  });

  useEffect(() => {
    if (!reportMessage) return;
    const timer = setTimeout(() => setReportMessage(null), 5000);
    return () => clearTimeout(timer);
  }, [reportMessage]);

  // Auto-save draft whenever exam state changes
  useEffect(() => {
    if (!inExamFlow || questions.length === 0 || !session) return;
    const draft: SimuladoDraft = {
      sessionId: session.id,
      questions,
      answers,
      currentIndex,
      markedForReview: Array.from(markedForReview),
    };
    safeLocalStorageSet(STORAGE_KEYS.simuladoDraft, draft);
  }, [inExamFlow, questions, answers, currentIndex, markedForReview, session]);

  // Auto-pause when tab goes hidden (crash / browser close recovery)
  useEffect(() => {
    if (!inExamFlow) return;
    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        pauseSession();
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [inExamFlow, pauseSession]);

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
    safeLocalStorageRemove(STORAGE_KEYS.simuladoDraft);
    setShowResumeModal(false);
    setResumeDraft(null);

    setLoading(true);

    try {
      const data = await createSimuladoQuestions({ count: 65, difficulties: ["easy", "medium", "hard"] });
      setQuestions(data.questions);
      setAnswers({});
      setCurrentIndex(0);
      setSubmitted(false);
      setSavedHistoryId(null);
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

  async function handleStartDevTest() {
    setError(null);
    safeLocalStorageRemove(STORAGE_KEYS.simuladoDraft);
    setShowResumeModal(false);
    setResumeDraft(null);

    const devQuestion: StudyQuestion = {
      id: "dev-test-001",
      statement:
        "[MODO DEV] Qual serviço AWS é usado para armazenamento de objetos escalável e durável com 99,999999999% de durabilidade?",
      certificationCode: "DEV",
      topic: "S3",
      difficulty: "easy",
      questionType: "single",
      options: {
        A: "Amazon EC2 (Elastic Compute Cloud)",
        B: "Amazon S3 (Simple Storage Service)",
        C: "Amazon RDS (Relational Database Service)",
        D: "AWS Lambda",
        E: "",
      },
      correctOption: "B",
      correctOptions: ["B"],
      explanations: {
        A: "EC2 é um serviço de computação em nuvem, não armazenamento de objetos.",
        B: "S3 é o serviço de armazenamento de objetos da AWS, altamente escalável e durável.",
        C: "RDS é um banco de dados relacional gerenciado.",
        D: "Lambda é um serviço de computação serverless.",
        E: "",
      },
      optionMapping: {
        displayToOriginal: { A: "A", B: "B", C: "C", D: "D", E: "E" },
        originalToDisplay: { A: "A", B: "B", C: "C", D: "D", E: "E" },
      },
    };

    setQuestions([devQuestion]);
    setAnswers({});
    setCurrentIndex(0);
    setSubmitted(false);
    setSavedHistoryId(null);
    setReviewByQuestion({});
    setLoadingReviewByQuestion({});
    setExamGuideInfo(null);
    setHistoricalWeakServices([]);
    setScoreOverview(null);
    setShowScoreOverview(false);
    setMotivationalMessage(null);
    setLoadingMotivationalMessage(false);
    setMarkedForReview(new Set());
    setShowPreSubmitSummary(false);
    confettiFiredRef.current = false;
    startSession("DEV", 4 / 60);
  }

  async function confirmRulesAndStart() {
    if (!rulesAccepted) {
      return;
    }

    persistRulesConsent(consentScope);
    setShowRulesModal(false);

    if (pendingPackId) {
      await handleStartFromPack(pendingPackId);
      setPendingPackId(null);
      setPendingPackName(null);
    } else {
      await handleStart();
    }
  }

  async function handleStartFromPack(packId: string) {
    setError(null);
    setHistoricalWeakServices([]);
    safeLocalStorageRemove(STORAGE_KEYS.simuladoDraft);
    setShowResumeModal(false);
    setResumeDraft(null);
    setLoading(true);

    try {
      const data = await createSimuladoQuestionsFromPack(packId);
      setCurrentPackId(data.packId);
      setQuestions(data.questions);
      setAnswers({});
      setCurrentIndex(0);
      setSubmitted(false);
      setSavedHistoryId(null);
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

  function handleOpenPackRulesModal(packId: string, packName: string) {
    if (hasValidRulesConsent(consentScope)) {
      void handleStartFromPack(packId);
      return;
    }
    setPendingPackId(packId);
    setPendingPackName(packName);
    setRulesAccepted(false);
    setShowRulesModal(true);
  }

  async function fetchReviewForQuestion(
    question: StudyQuestion,
    answer: StudyAnswerMap[string],
    historyId?: string | null,
  ) {
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

      const nextReview: StudyExplanationResult = {
        summary: explanation.summary,
        options: explanation.options,
      };
      setReviewByQuestion((prev) => ({
        ...prev,
        [question.id]: nextReview,
      }));

      if (historyId) {
        try {
          await saveStudyHistoryExplanation({
            historyId,
            questionId: question.id,
            explanationSummary: nextReview.summary,
            explanations: nextReview.options,
          });
        } catch {
          // Best effort to persist review in session history.
        }
      }
    } catch {
      const nextReview: StudyExplanationResult = {
        summary: "Revisao local baseada no gabarito da questao.",
        options: question.explanations,
      };

      setReviewByQuestion((prev) => ({
        ...prev,
        [question.id]: nextReview,
      }));

      if (historyId) {
        try {
          await saveStudyHistoryExplanation({
            historyId,
            questionId: question.id,
            explanationSummary: nextReview.summary,
            explanations: nextReview.options,
          });
        } catch {
          // Best effort to persist review in session history.
        }
      }
    } finally {
      setLoadingReviewByQuestion((prev) => ({ ...prev, [question.id]: false }));
    }
  }

  async function submitQuestionReport(input: {
    reason:
      | "INCORRECT_ANSWER"
      | "UNCLEAR_STATEMENT"
      | "MISSING_CONTEXT"
      | "GRAMMAR_TYPO"
      | "DUPLICATE"
      | "QUALITY_ISSUE"
      | "OTHER";
    description: string;
  }) {
    if (!currentQuestion) {
      return;
    }

    setReportMessage(null);
    setReportSubmitting(true);

    try {
      await reportStudyQuestion({
        questionId: currentQuestion.id,
        reason: input.reason,
        description: input.description,
      });
      setReportMessage("Denuncia enviada com sucesso. Obrigado por ajudar a melhorar o banco de questoes.");
    } finally {
      setReportSubmitting(false);
    }
  }

  async function handleSubmitExam() {
    if (!session || questions.length === 0) {
      return;
    }

    setCalculating(true);
    setShowPreSubmitSummary(false);

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

    safeLocalStorageRemove(STORAGE_KEYS.simuladoDraft);
    submitSession();
    clearSession();

    let historySaved = false;
    let savedHistoryIdValue: string | null = null;
    try {
      const saveResult = await saveStudyHistory({
        sessionType: "SIMULADO",
        title: `Simulado ${session.certificationCode}`,
        certificationCode: session.certificationCode,
        gainedXp,
        scorePercent,
        correctAnswers,
        totalQuestions,
        durationSeconds: usedDurationSeconds,
        packId: currentPackId,
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
          explanationSummary: reviewByQuestion[question.id]?.summary,
          explanations: {
            A: reviewByQuestion[question.id]?.options.A ?? question.explanations.A ?? "Sem explicacao.",
            B: reviewByQuestion[question.id]?.options.B ?? question.explanations.B ?? "Sem explicacao.",
            C: reviewByQuestion[question.id]?.options.C ?? question.explanations.C ?? "Sem explicacao.",
            D: reviewByQuestion[question.id]?.options.D ?? question.explanations.D ?? "Sem explicacao.",
            E: reviewByQuestion[question.id]?.options.E ?? question.explanations.E ?? "Nao aplicavel.",
          },
        })),
      });

      historySaved = saveResult.ok;
      savedHistoryIdValue = saveResult.itemId ?? null;
      setSavedHistoryId(savedHistoryIdValue);

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
    } catch {
      historySaved = false;
      savedHistoryIdValue = null;
      setSavedHistoryId(null);
    }

    setSubmitted(true);
    setShowPreSubmitSummary(false);
    setCurrentIndex(0);
    const performance = buildTopicPerformance(questions, answers);
    const overview = buildScoreOverview(correctAnswers, totalQuestions, performance);
    setScoreOverview(overview);
    setShowScoreOverview(true);
    setCalculating(false);

    if (!confettiFiredRef.current && overview.points >= overview.minimumCertificationPoints) {
      confettiFiredRef.current = true;
      playSuccessSound();
      void triggerConfetti();
    }

    const passed = overview.points >= overview.minimumCertificationPoints;
    setMotivationalMessage(null);
    setLoadingMotivationalMessage(true);
    void (async () => {
      try {
        const res = await fetch("/api/study/simulado-message", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userName: profile.name,
            certificationCode: session?.certificationCode,
            scorePercent: scorePercent,
            passed,
            correctAnswers: correctAnswers,
            totalQuestions: totalQuestions,
            bestArea: overview.bestArea?.topic ?? null,
            weakestArea: overview.weakestArea?.topic ?? null,
          }),
        });
        const data = (await res.json()) as { message?: string };
        setMotivationalMessage(
          data.message ??
            (passed
              ? "Excelente trabalho! Sua dedicacao esta valendo a pena. Continue praticando para a certificacao. Nos acreditamos em voce!"
              : "Nao desanime! Cada simulado te deixa mais preparado. Analise seus pontos fracos e continue praticando. Eu acredito em voce!"),
        );
      } catch {
        setMotivationalMessage(
          passed
            ? "Excelente trabalho! Sua dedicacao esta valendo a pena. Continue praticando para a certificacao. Nos acreditamos em voce!"
            : "Nao desanime! Cada simulado te deixa mais preparado. Analise seus pontos fracos e continue praticando. Eu acredito em voce!",
        );
      } finally {
        setLoadingMotivationalMessage(false);
      }
    })();

    setLoadingWeakServices(true);
    try {
      const weakServices = await fetchWeakServices({ take: GAP_TOP_N, sample: 35 });
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
      await fetchReviewForQuestion(
        questions[0],
        answers[questions[0].id] ?? questions[0].correctOption,
        savedHistoryIdValue,
      );
    }
  }

  function handleForceExit() {
    safeLocalStorageRemove(STORAGE_KEYS.simuladoDraft);
    clearSession();
    setQuestions([]);
    setAnswers({});
    setCurrentIndex(0);
    setCalculating(false);
    router.replace("/");
  }

  function handleReset() {
    setQuestions([]);
    setAnswers({});
    setCurrentIndex(0);
    setSubmitted(false);
    setSavedHistoryId(null);
    setReviewByQuestion({});
    setLoadingReviewByQuestion({});
    setExamGuideInfo(null);
    setHistoricalWeakServices([]);
    setLoadingWeakServices(false);
    setScoreOverview(null);
    setShowScoreOverview(false);
    setError(null);
    setMarkedForReview(new Set());
    setShowPreSubmitSummary(false);
    setFocusMode(false);
    setCalculating(false);
    setMotivationalMessage(null);
    setLoadingMotivationalMessage(false);
    setCurrentPackId(null);
    setExpandedPackHistory(null);
    confettiFiredRef.current = false;
  }

  function toggleMarkForReview(questionId: string) {
    setMarkedForReview((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  }

  async function goToQuestion(index: number) {
    const clamped = Math.max(0, Math.min(questions.length - 1, index));
    setCurrentIndex(clamped);

    if (submitted) {
      const target = questions[clamped];
      if (target) {
        await fetchReviewForQuestion(target, answers[target.id] ?? target.correctOption, savedHistoryId);
      }
    }
  }

  function navigateHome() {
    router.replace("/");
  }

  function navigateToKcGaps() {
    router.push(`/kc?topics=${encodeURIComponent(strongestGapTopics.map(toTopicCode).join(","))}`);
  }

  function navigateToLabGaps() {
    router.push(
      `/lab?focus=${encodeURIComponent(strongestGapTopics.join(", "))}&labText=${encodeURIComponent(buildGapLabSeed(strongestGapTopics))}`,
    );
  }

  if (!hydrated) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <p className="font-mono text-xs uppercase text-[var(--pixel-subtext)]">Carregando...</p>
      </main>
    );
  }

  const simuladoContextValue = {
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
    session: session as { id: string; certificationCode: string; startedAt: string; endsAt: string } | null,
    focusMode,
    isPaused,
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
  };

  return (
    <SimuladoContext.Provider value={simuladoContextValue}>
      <TooltipProvider>
        <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 xl:px-8">
          {process.env.NODE_ENV !== "production" && !inExamFlow && !inReviewFlow && (
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => void handleStartDevTest()}
                className="border border-yellow-700 px-3 py-2 text-xs uppercase text-yellow-300"
              >
                Simulado Teste (1q / 4s)
              </button>
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
                Score mock (dev)
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

          {(activeOverview ?? (calculating && !submitted)) && (
            <SimuladoResultOverview
              overview={
                activeOverview ?? {
                  points: 0,
                  maxPoints: 1000,
                  minimumCertificationPoints: 700,
                  bestArea: null,
                  weakestArea: null,
                }
              }
              calculating={calculating}
              submitted={submitted}
              loadingMotivationalMessage={loadingMotivationalMessage}
              motivationalMessage={motivationalMessage}
              onHideOverview={process.env.NODE_ENV !== "production" ? () => setShowScoreOverview(false) : undefined}
            />
          )}

          {!inExamFlow && !inReviewFlow && !calculating && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut", delay: 0.05 }}
              className="space-y-4"
            >
              {/* Certification header */}
              {certInfo && (
                <div className="flex flex-wrap items-center justify-between gap-2 border border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-4 py-3">
                  <div>
                    <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Certificacao alvo</p>
                    <p className="mt-0.5 font-mono text-sm text-[var(--pixel-primary)]">
                      {certInfo.code} — {certInfo.name}
                    </p>
                  </div>
                  <a
                    href="/profile"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border border-[var(--pixel-border)] px-3 py-1.5 font-mono text-[10px] uppercase text-[var(--pixel-subtext)] hover:border-[var(--pixel-primary)] hover:text-[var(--pixel-primary)]"
                  >
                    Alterar no perfil ↗
                  </a>
                </div>
              )}

              <PixelCard className="space-y-0 p-0 overflow-hidden">
                {/* Tabs */}
                <div className="flex border-b border-[var(--pixel-border)]">
                  {(["simulados", "examGuide"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTab(tab)}
                      className={[
                        "flex-1 px-4 py-3 font-mono text-[10px] uppercase transition-colors",
                        activeTab === tab
                          ? "border-b-2 border-[var(--pixel-primary)] bg-[var(--pixel-bg)] text-[var(--pixel-primary)]"
                          : "text-[var(--pixel-subtext)] hover:text-[var(--pixel-text)]",
                      ].join(" ")}
                    >
                      {tab === "simulados" ? "Simulados" : "Exam Guide"}
                    </button>
                  ))}
                </div>

                {/* Simulados Tab */}
                {activeTab === "simulados" && (
                  <div className="space-y-4 p-4">
                    <SimuladoPacksGrid
                      packs={packs}
                      packsLoading={packsLoading}
                      error={error}
                      packsFilter={packsFilter}
                      packsDifficultyFilter={packsDifficultyFilter}
                      packsSearch={packsSearch}
                      packsSort={packsSort}
                      packsView={packsView}
                      expandedPackHistory={expandedPackHistory}
                      loading={loading}
                      onFilterChange={setPacksFilter}
                      onDifficultyFilterChange={setPacksDifficultyFilter}
                      onSearchChange={setPacksSearch}
                      onSortChange={setPacksSort}
                      onViewChange={setPacksView}
                      onRefresh={() => setPacksRefreshKey((k) => k + 1)}
                      onToggleHistory={(id) => setExpandedPackHistory(id)}
                      onStartPack={handleOpenPackRulesModal}
                    />
                  </div>
                )}

                {/* Exam Guide Tab */}
                {activeTab === "examGuide" && (
                  <div className="space-y-4 p-4">
                    <SimuladoExamGuide
                      examGuideInfo={examGuideInfo}
                      loadingExamGuide={loadingExamGuide}
                      examGuideError={examGuideError}
                    />
                  </div>
                )}
              </PixelCard>
            </motion.div>
          )}

          <SimuladoRulesModal
            open={showRulesModal}
            packName={pendingPackName ?? null}
            rulesAccepted={rulesAccepted}
            loading={loading}
            onAcceptedChange={setRulesAccepted}
            onCancel={() => setShowRulesModal(false)}
            onConfirm={() => void confirmRulesAndStart()}
          />

          <SimuladoExamFlow />

          <SimuladoResumeModal
            open={showResumeModal}
            draft={resumeDraft}
            timerLabel={timerLabel}
            onResume={() => {
              if (!resumeDraft) return;
              setQuestions(resumeDraft.questions);
              setAnswers(resumeDraft.answers as StudyAnswerMap);
              setCurrentIndex(resumeDraft.currentIndex);
              setMarkedForReview(new Set(resumeDraft.markedForReview));
              if (isPaused) resumeSession();
              setShowResumeModal(false);
              setResumeDraft(null);
            }}
            onDiscard={() => {
              safeLocalStorageRemove(STORAGE_KEYS.simuladoDraft);
              clearSession();
              setShowResumeModal(false);
              setResumeDraft(null);
            }}
          />
        </main>
      </TooltipProvider>
    </SimuladoContext.Provider>
  );
}
