"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { PixelButton } from "@/components/ui/pixel-button";
import { PixelCard } from "@/components/ui/pixel-card";
import { STUDY_OPTIONS, StudyAnswerMap, StudyExplanationResult } from "@/features/study";
import { QuestionReviewPanel } from "@/features/study/components/QuestionReviewPanel";
import { ReportQuestionModal } from "@/features/study/components/ReportQuestionModal";
import { SimuladoScoreGauge } from "@/features/study/components/SimuladoScoreGauge";
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
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useSimulatedExam } from "@/hooks/useSimulatedExam";
import { useUserProfile } from "@/hooks/useUserProfile";
import { getTaskXpByDifficulty } from "@/lib/levels";
import { normalizeOptionText } from "@/lib/study-option-text";
import { STORAGE_KEYS, safeLocalStorageGet, safeLocalStorageRemove, safeLocalStorageSet } from "@/lib/storage";
import { QuestionOption, SimuladoDraft, StudyQuestion, TaskDifficulty } from "@/lib/types";

const OPTIONS: QuestionOption[] = STUDY_OPTIONS;
const GAP_TOP_N = 10;

function toggleMultiAnswer(current: QuestionOption[], option: QuestionOption): QuestionOption[] {
  if (current.includes(option)) {
    return current.filter((item) => item !== option).sort();
  }
  return [...current, option].sort();
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `há ${days} dia${days > 1 ? "s" : ""}`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `há ${weeks} semana${weeks > 1 ? "s" : ""}`;
  const months = Math.floor(days / 30);
  if (months < 12) return `há ${months} ${months === 1 ? "mês" : "meses"}`;
  const years = Math.floor(days / 365);
  return `há ${years} ano${years > 1 ? "s" : ""}`;
}

type RulesConsentMap = Record<string, string>;

type SimuladoPackListItem = {
  id: string;
  name: string;
  questionCount: number;
  artworkUrl: string | null;
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
  const [packsRefreshKey, setPacksRefreshKey] = useState(0);
  const [packsSearch, setPacksSearch] = useState("");
  const [packsSort, setPacksSort] = useState<"newest" | "oldest" | "name_az" | "score_desc">("newest");
  const { value: packsView, setValue: setPacksView } = useLocalStorage<"grid" | "list">(STORAGE_KEYS.simuladoPacksView, "grid");
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
    return () => { cancelled = true; };
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

            <SimuladoScoreGauge
              points={activeOverview.points}
              maxPoints={activeOverview.maxPoints}
              minimumCertificationPoints={activeOverview.minimumCertificationPoints}
            />

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

            {/* Motivational message */}
            {(loadingMotivationalMessage || motivationalMessage) && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className={`rounded border px-4 py-3 ${
                  activeOverview.points >= activeOverview.minimumCertificationPoints
                    ? "border-[#14532d] bg-green-900/15"
                    : "border-[#1d4ed8] bg-blue-900/15"
                }`}
              >
                <p className={`font-mono text-[10px] uppercase ${
                  activeOverview.points >= activeOverview.minimumCertificationPoints
                    ? "text-green-400"
                    : "text-blue-400"
                }`}>
                  Mensagem do AWSLQ
                </p>
                {loadingMotivationalMessage ? (
                  <p className="mt-2 flex items-center gap-2 font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
                    <span className="h-3 w-3 animate-spin rounded-full border border-current border-r-transparent" />
                    Preparando mensagem personalizada...
                  </p>
                ) : (
                  <p className="mt-2 font-[var(--font-body)] text-sm leading-relaxed text-[var(--pixel-text)]">
                    {motivationalMessage}
                  </p>
                )}
              </motion.div>
            )}
          </PixelCard>
        </motion.div>
      )}
      {calculating && !submitted && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <PixelCard className="space-y-6 py-10 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="relative flex h-16 w-16 items-center justify-center">
                <span className="absolute h-full w-full animate-ping rounded-full border-2 border-[var(--pixel-accent)] opacity-30" />
                <span className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--pixel-accent)] border-r-transparent" />
              </div>
              <div className="space-y-1">
                <p className="font-mono text-sm uppercase text-[var(--pixel-primary)]">Calculando resultado</p>
                <p className="font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">
                  Processando suas respostas e calculando a pontuacao final...
                </p>
              </div>
            </div>
            <div className="mx-auto flex max-w-xs flex-col gap-2">
              {["Verificando respostas", "Calculando score", "Gerando overview de desempenho"].map((step, i) => (
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.18, duration: 0.25 }}
                  className="flex items-center gap-2 text-left"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--pixel-accent)]" />
                  <span className="font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">{step}</span>
                </motion.div>
              ))}
            </div>
          </PixelCard>
        </motion.div>
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
                {/* Filter bar */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {(["all", "todo", "done"] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setPacksFilter(f)}
                        className={[
                          "border px-3 py-1 font-mono text-[10px] uppercase",
                          packsFilter === f
                            ? "border-[var(--pixel-primary)] text-[var(--pixel-primary)]"
                            : "border-[var(--pixel-border)] text-[var(--pixel-subtext)] hover:border-[var(--pixel-primary)]/50",
                        ].join(" ")}
                      >
                        {f === "all" ? "Todos" : f === "todo" ? "Nao realizados" : "Realizados"}
                      </button>
                    ))}
                    <div className="ml-auto flex items-center gap-1">
                      {(["grid", "list"] as const).map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setPacksView(v)}
                          title={v === "grid" ? "Grade" : "Lista"}
                          className={[
                            "border px-2 py-1 font-mono text-[11px] leading-none",
                            packsView === v
                              ? "border-[var(--pixel-primary)] text-[var(--pixel-primary)]"
                              : "border-[var(--pixel-border)] text-[var(--pixel-subtext)] hover:border-[var(--pixel-primary)]/50",
                          ].join(" ")}
                        >
                          {v === "grid" ? "⊞" : "☰"}
                        </button>
                      ))}
                      <button
                        type="button"
                        disabled={packsLoading}
                        onClick={() => setPacksRefreshKey((k) => k + 1)}
                        className="border border-[var(--pixel-border)] px-3 py-1 font-mono text-[10px] uppercase text-[var(--pixel-subtext)] hover:border-[var(--pixel-primary)]/50 disabled:opacity-40"
                      >
                        {packsLoading ? "..." : "↻ Atualizar"}
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      value={packsSearch}
                      onChange={(e) => setPacksSearch(e.target.value)}
                      placeholder="Buscar pack..."
                      className="border border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-1.5 font-mono text-[10px] text-[var(--pixel-text)] outline-none focus:border-[var(--pixel-primary)]/50"
                    />
                    <select
                      value={packsSort}
                      onChange={(e) => setPacksSort(e.target.value as typeof packsSort)}
                      className="border border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-1.5 font-mono text-[10px] text-[var(--pixel-subtext)] outline-none"
                    >
                      <option value="newest">Mais recentes</option>
                      <option value="oldest">Mais antigos</option>
                      <option value="name_az">Nome A-Z</option>
                      <option value="score_desc">Melhor pontuacao</option>
                    </select>
                    {packsSearch && (
                      <button
                        type="button"
                        onClick={() => setPacksSearch("")}
                        className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)] hover:text-[var(--pixel-primary)]"
                      >
                        ✕ Limpar busca
                      </button>
                    )}
                  </div>
                </div>

                {error && <p className="font-[var(--font-body)] text-sm text-red-300">{error}</p>}

                {packsLoading && (
                  <p className="font-mono text-xs uppercase text-[var(--pixel-subtext)]">Carregando packs...</p>
                )}

                {!packsLoading && packs.length === 0 && (
                  <div className="border border-[var(--pixel-border)] bg-[var(--pixel-bg)] p-6 text-center">
                    <p className="font-mono text-xs uppercase text-[var(--pixel-subtext)]">
                      {packsFilter === "todo"
                        ? "Nenhum pack pendente."
                        : packsFilter === "done"
                          ? "Nenhum pack realizado ainda."
                          : "Nenhum pack disponivel para sua certificacao."}
                    </p>
                    {packsFilter === "all" && (
                      <p className="mt-2 font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">
                        Um administrador precisa gerar packs de simulado para sua certificacao.
                      </p>
                    )}
                  </div>
                )}

                {(() => {
                  const search = packsSearch.trim().toLowerCase();
                  const filtered = search
                    ? packs.filter((p) => p.name.toLowerCase().includes(search))
                    : packs;
                  const sorted = [...filtered].sort((a, b) => {
                    if (packsSort === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                    if (packsSort === "name_az") return a.name.localeCompare(b.name);
                    if (packsSort === "score_desc") return (b.bestScore ?? -1) - (a.bestScore ?? -1);
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                  });
                  if (!packsLoading && filtered.length === 0 && packs.length > 0) {
                    return (
                      <p className="font-mono text-xs uppercase text-[var(--pixel-subtext)]">
                        Nenhum pack encontrado para &ldquo;{packsSearch}&rdquo;.
                      </p>
                    );
                  }
                  return (
                <div className={packsView === "list" ? "flex flex-col gap-2" : "grid gap-3 md:grid-cols-2"}>
                  {sorted.map((pack) => {
                    const done = pack.attempts > 0;
                    const passed = done && pack.bestScore !== null && pack.bestScore >= 70;
                    const isExpanded = expandedPackHistory === pack.id;

                    return (
                      <div
                        key={pack.id}
                        className={[
                          "border overflow-hidden",
                          passed
                            ? "border-green-700/60 bg-green-900/10"
                            : done
                              ? "border-yellow-700/60 bg-yellow-900/10"
                              : "border-[var(--pixel-border)] bg-[var(--pixel-bg)]",
                        ].join(" ")}
                      >
                        {packsView === "list" ? (
                          /* List row layout — image left, content right */
                          <div className="flex min-h-[5.5rem] items-stretch">
                            <div className="w-24 shrink-0 overflow-hidden border-r border-[var(--pixel-border)]">
                              {pack.artworkUrl ? (
                                <img
                                  src={pack.artworkUrl}
                                  alt={pack.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center bg-[var(--pixel-primary)]/10">
                                  <span className="font-mono text-2xl font-bold text-[var(--pixel-primary)]">
                                    {pack.name.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                              )}
                            </div>

                            <div className="flex min-w-0 flex-1 flex-col justify-between p-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="truncate font-mono text-xs font-bold text-[var(--pixel-primary)]">
                                    {pack.name}
                                  </p>
                                  <p className="font-mono text-[10px] text-[var(--pixel-subtext)]">
                                    {pack.questionCount} questoes · {timeAgo(pack.createdAt)}
                                  </p>
                                  {done && (
                                    <p className="mt-0.5 font-mono text-[10px] text-[var(--pixel-subtext)]">
                                      Melhor:{" "}
                                      <span className="text-[var(--pixel-text)]">{pack.bestScore}%</span>
                                      {" · "}
                                      Tent.:{" "}
                                      <span className="text-[var(--pixel-text)]">{pack.attempts}</span>
                                    </p>
                                  )}
                                </div>
                                {done && (
                                  <span
                                    className={[
                                      "shrink-0 border px-2 py-0.5 font-mono text-[10px] uppercase",
                                      passed
                                        ? "border-green-700 text-green-400"
                                        : "border-yellow-700 text-yellow-400",
                                    ].join(" ")}
                                  >
                                    {passed ? "Aprovado" : "Reprovado"}
                                  </span>
                                )}
                              </div>

                              <div className="mt-2 flex flex-wrap gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenPackRulesModal(pack.id, pack.name)}
                                  disabled={loading}
                                  className="border border-[var(--pixel-primary)] px-2 py-1 font-mono text-[10px] uppercase text-[var(--pixel-primary)] hover:bg-[var(--pixel-primary)]/10 disabled:opacity-50"
                                >
                                  {loading ? "..." : done ? "Refazer" : "Iniciar"}
                                </button>
                                {done && pack.lastSessionId && (
                                  <a
                                    href={`/study/history/${pack.lastSessionId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="border border-[var(--pixel-border)] px-2 py-1 font-mono text-[10px] uppercase text-[var(--pixel-subtext)] hover:border-[var(--pixel-primary)] hover:text-[var(--pixel-primary)]"
                                  >
                                    Revisar ↗
                                  </a>
                                )}
                                {pack.attempts > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => setExpandedPackHistory(isExpanded ? null : pack.id)}
                                    className="border border-[var(--pixel-border)] px-2 py-1 font-mono text-[10px] uppercase text-[var(--pixel-subtext)] hover:border-[var(--pixel-primary)]/50"
                                  >
                                    {isExpanded ? "Fechar" : `Hist. (${pack.attempts})`}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : pack.artworkUrl ? (
                          /* Game-cover layout — image fills square container with gradient overlay */
                          <div className="relative aspect-square w-full">
                            <img
                              src={pack.artworkUrl}
                              alt={pack.name}
                              className="h-full w-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />
                            <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-3">
                              <div className="flex items-end justify-between gap-2">
                                <p className="font-mono text-sm font-bold leading-tight text-primary drop-shadow">
                                  {pack.name}
                                </p>
                                {done && (
                                  <span
                                    className={[
                                      "shrink-0 border px-2 py-0.5 font-mono text-[10px] uppercase backdrop-blur-sm",
                                      passed
                                        ? "border-green-600 bg-green-900/70 text-green-300"
                                        : "border-yellow-600 bg-yellow-900/70 text-yellow-300",
                                    ].join(" ")}
                                  >
                                    {passed ? "Aprovado" : "Reprovado"}
                                  </span>
                                )}
                              </div>

                              {done && (
                                <div className="flex items-center gap-3 font-mono text-[10px] text-white/70">
                                  <span>
                                    Melhor: <span className="text-white">{pack.bestScore}%</span>
                                  </span>
                                  <span>
                                    Tentativas: <span className="text-white">{pack.attempts}</span>
                                  </span>
                                </div>
                              )}

                              <p className="font-mono text-[10px] text-white/50">
                                {pack.questionCount} questoes · {timeAgo(pack.createdAt)}
                              </p>

                              <div className="flex flex-wrap gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenPackRulesModal(pack.id, pack.name)}
                                  disabled={loading}
                                  className="border border-white/50 bg-black/40 px-3 py-1.5 font-mono text-[10px] uppercase text-white backdrop-blur-sm hover:bg-white/10 disabled:opacity-50"
                                >
                                  {loading ? "..." : done ? "Refazer" : "Iniciar"}
                                </button>

                                {done && pack.lastSessionId && (
                                  <a
                                    href={`/study/history/${pack.lastSessionId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="border border-white/30 bg-black/40 px-3 py-1.5 font-mono text-[10px] uppercase text-white/70 backdrop-blur-sm hover:text-white"
                                  >
                                    Revisar ultima ↗
                                  </a>
                                )}

                                {pack.attempts > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => setExpandedPackHistory(isExpanded ? null : pack.id)}
                                    className="border border-white/30 bg-black/40 px-3 py-1.5 font-mono text-[10px] uppercase text-white/60 backdrop-blur-sm hover:text-white/90"
                                  >
                                    {isExpanded ? "Fechar" : `Historico (${pack.attempts})`}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          /* Compact layout — no artwork */
                          <div className="space-y-3 p-4">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-[var(--pixel-border)] bg-[var(--pixel-primary)]/10">
                                  <span className="font-mono text-lg font-bold text-[var(--pixel-primary)]">
                                    {pack.name.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <div>
                                  <p className="font-mono text-xs text-[var(--pixel-primary)]">{pack.name}</p>
                                  <p className="mt-0.5 font-mono text-[10px] text-[var(--pixel-subtext)]">
                                    {pack.questionCount} questoes · {timeAgo(pack.createdAt)}
                                  </p>
                                </div>
                              </div>
                              {done && (
                                <span
                                  className={[
                                    "shrink-0 border px-2 py-0.5 font-mono text-[10px] uppercase",
                                    passed
                                      ? "border-green-700 text-green-400"
                                      : "border-yellow-700 text-yellow-400",
                                  ].join(" ")}
                                >
                                  {passed ? "Aprovado" : "Reprovado"}
                                </span>
                              )}
                            </div>

                            {done && (
                              <div className="flex items-center gap-4 font-mono text-[10px] text-[var(--pixel-subtext)]">
                                <span>
                                  Melhor: <span className="text-[var(--pixel-text)]">{pack.bestScore}%</span>
                                </span>
                                <span>
                                  Tentativas: <span className="text-[var(--pixel-text)]">{pack.attempts}</span>
                                </span>
                              </div>
                            )}

                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => handleOpenPackRulesModal(pack.id, pack.name)}
                                disabled={loading}
                                className="border border-[var(--pixel-primary)] px-3 py-1.5 font-mono text-[10px] uppercase text-[var(--pixel-primary)] hover:bg-[var(--pixel-primary)]/10 disabled:opacity-50"
                              >
                                {loading ? "..." : done ? "Refazer" : "Iniciar"}
                              </button>

                              {done && pack.lastSessionId && (
                                <a
                                  href={`/study/history/${pack.lastSessionId}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="border border-[var(--pixel-border)] px-3 py-1.5 font-mono text-[10px] uppercase text-[var(--pixel-subtext)] hover:border-[var(--pixel-primary)] hover:text-[var(--pixel-primary)]"
                                >
                                  Revisar ultima ↗
                                </a>
                              )}

                              {pack.attempts > 1 && (
                                <button
                                  type="button"
                                  onClick={() => setExpandedPackHistory(isExpanded ? null : pack.id)}
                                  className="border border-[var(--pixel-border)] px-3 py-1.5 font-mono text-[10px] uppercase text-[var(--pixel-subtext)] hover:border-[var(--pixel-primary)]/50"
                                >
                                  {isExpanded ? "Fechar" : `Historico (${pack.attempts})`}
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        {isExpanded && (
                          <div className="divide-y divide-[var(--pixel-border)] border-t border-[var(--pixel-border)]">
                            {pack.sessions.map((s) => (
                              <div key={s.id} className="flex items-center justify-between px-3 py-2">
                                <div>
                                  <p className="font-mono text-[10px] text-[var(--pixel-text)]">
                                    {s.scorePercent}% — {s.correctAnswers}/{s.totalQuestions}
                                  </p>
                                  <p className="font-mono text-[10px] text-[var(--pixel-subtext)]">
                                    {new Date(s.completedAt).toLocaleDateString("pt-BR")}
                                  </p>
                                </div>
                                <a
                                  href={`/study/history/${s.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)] hover:text-[var(--pixel-primary)]"
                                >
                                  Revisar ↗
                                </a>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                  );
                })()}
              </div>
            )}

            {/* Exam Guide Tab */}
            {activeTab === "examGuide" && (
              <div className="space-y-4 p-4">
                {loadingExamGuide && (
                  <p className="font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">Carregando Exam Guide...</p>
                )}

                {examGuideError && !loadingExamGuide && (
                  <p className="font-[var(--font-body)] text-xs text-yellow-300">{examGuideError}</p>
                )}

                {examGuideInfo && (
                  <div className="space-y-3">
                    <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">
                      Exam guide oficial — {examGuideInfo.totalChars} caracteres
                    </p>

                    {examGuideInfo.highlights.length > 0 && (
                      <div className="space-y-1 border border-[var(--pixel-border)] bg-[var(--pixel-bg)] p-3">
                        <p className="font-mono text-[10px] uppercase text-[var(--pixel-accent)]">Topicos de foco</p>
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

                    {examGuideInfo.markdown.trim().length > 0 && (
                      <div className="max-h-[40rem] overflow-auto border border-[var(--pixel-border)] bg-[var(--pixel-card)] p-3">
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
                    )}
                  </div>
                )}

                {!examGuideInfo && !loadingExamGuide && !examGuideError && (
                  <p className="font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">
                    Exam guide nao configurado para esta certificacao.
                  </p>
                )}
              </div>
            )}
          </PixelCard>
        </motion.div>
      )}

      {showRulesModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4" role="dialog" aria-modal="true">
          <PixelCard className="w-full max-w-2xl space-y-4 border-yellow-500 bg-yellow-900/95">
            <p className="font-mono text-[10px] uppercase text-yellow-300">Regras do Simulado</p>
            <h3 className="font-[var(--font-body)] text-xl">
              {pendingPackName ?? "Ambiente de prova real"}
            </h3>

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
        <div className={`grid gap-4 ${focusMode ? "" : "xl:grid-cols-[minmax(0,1fr)_340px]"}`}>
          <section className="space-y-4">
            {inExamFlow && (
              <PixelCard className={`flex flex-wrap items-center justify-between gap-2 ${isPaused ? "border-yellow-500 bg-yellow-900/10" : "border-red-500 bg-red-900/10"}`}>
                <p className={`font-mono text-[10px] uppercase ${isPaused ? "text-yellow-300" : "text-red-300"}`}>
                  {isPaused ? "Simulado pausado · " : "Prova em andamento · "}Certificacao {session?.certificationCode}
                </p>
                <div className="flex items-center gap-2">
                  {!focusMode && (
                    <div className={`border-2 px-3 py-1 font-mono text-sm ${isPaused ? "border-yellow-400 text-yellow-300" : "border-red-400 text-red-300"}`}>
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
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
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
                        title={markedForReview.has(currentQuestion.id) ? "Remover marcacao de revisao" : "Marcar para revisao"}
                        className={`flex items-center gap-1 border px-2 py-0.5 font-mono text-[10px] uppercase transition-colors ${
                          markedForReview.has(currentQuestion.id)
                            ? "border-yellow-400 bg-yellow-900/30 text-yellow-300"
                            : "border-[var(--pixel-border)] text-[var(--pixel-subtext)] hover:border-yellow-500 hover:text-yellow-400"
                        }`}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill={markedForReview.has(currentQuestion.id) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
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
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                    </button>
                  </div>
                </div>

                <p className={`font-[var(--font-body)] ${focusMode ? "text-lg" : "text-base"}`}>{currentQuestion.statement}</p>
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

                {/* Barra de navegação dinâmica */}
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
                      <PixelButton variant="ghost" onClick={() => router.replace("/")}>
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

              {/* Barra de progresso */}
              <div className="space-y-1">
                <div className="flex justify-between font-mono text-[10px] text-[var(--pixel-subtext)]">
                  <span>Respondidas: {answeredCount}/{questions.length}</span>
                  {inExamFlow && markedForReview.size > 0 && (
                    <span className="text-yellow-400">{markedForReview.size} p/ revisao</span>
                  )}
                </div>
                {inExamFlow && (
                  <div className="h-1 w-full overflow-hidden rounded bg-[var(--pixel-border)]">
                    <div
                      className="h-full bg-[var(--pixel-accent)] transition-all duration-300"
                      style={{ width: `${questions.length > 0 ? (answeredCount / questions.length) * 100 : 0}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Legenda */}
              {inExamFlow && (
                <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[9px] text-[var(--pixel-subtext)]">
                  <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 border border-[var(--pixel-accent)] bg-[var(--pixel-accent)]/30" />Resp.</span>
                  <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 border border-yellow-400 bg-yellow-900/30" />Revisar</span>
                  <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 border border-[var(--pixel-border)] bg-[var(--pixel-bg)]" />Vazia</span>
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

              {/* Botões de ação do exam centralizados na sidebar */}
              {inExamFlow && (
                <div className="flex flex-col gap-2 border-t border-[var(--pixel-border)] pt-3">
                  <PixelButton
                    onClick={() => setShowPreSubmitSummary(true)}
                    disabled={!allQuestionsAnswered}
                    className="w-full justify-center"
                  >
                    Enviar Simulado
                  </PixelButton>
                  <PixelButton variant="ghost" onClick={handleForceExit} className="w-full justify-center text-center">
                    Encerrar
                  </PixelButton>
                </div>
              )}
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

      {/* Modal de resumo pré-envio */}
      {showPreSubmitSummary && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4" role="dialog" aria-modal="true">
          <PixelCard className="w-full max-w-xl space-y-4">
            <p className="font-mono text-[10px] uppercase text-[var(--pixel-primary)]">Resumo antes de enviar</p>
            <h3 className="font-[var(--font-body)] text-lg">Revise antes de confirmar</h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="border border-[var(--pixel-border)] bg-[var(--pixel-bg)] p-3 text-center">
                <p className="font-mono text-2xl text-[var(--pixel-primary)]">{answeredCount}</p>
                <p className="mt-1 font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Respondidas</p>
              </div>
              <div className="border border-[var(--pixel-border)] bg-[var(--pixel-bg)] p-3 text-center">
                <p className="font-mono text-2xl text-yellow-400">{markedForReview.size}</p>
                <p className="mt-1 font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Marcadas p/ revisao</p>
              </div>
            </div>

            {markedForReview.size > 0 && (
              <div className="space-y-2">
                <p className="font-mono text-[10px] uppercase text-yellow-400">Questoes marcadas para revisao</p>
                <div className="flex flex-wrap gap-2">
                  {questions.map((q, i) =>
                    markedForReview.has(q.id) ? (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => {
                          setShowPreSubmitSummary(false);
                          void goToQuestion(i);
                        }}
                        className="border border-yellow-400 bg-yellow-900/20 px-2 py-1 font-mono text-[10px] text-yellow-300 hover:bg-yellow-900/40"
                      >
                        Q{i + 1}
                      </button>
                    ) : null,
                  )}
                </div>
              </div>
            )}

            {answeredCount < questions.length && (
              <p className="font-[var(--font-body)] text-xs text-yellow-300">
                Atencao: {questions.length - answeredCount} questao(oes) sem resposta serao contadas como erradas.
              </p>
            )}

            <div className="flex justify-end gap-2">
              <PixelButton variant="ghost" onClick={() => setShowPreSubmitSummary(false)}>
                Voltar para revisar
              </PixelButton>
              <PixelButton onClick={() => void handleSubmitExam()}>Confirmar Envio</PixelButton>
            </div>
          </PixelCard>
        </div>
      )}

      {currentQuestion && (
        <ReportQuestionModal
          open={reportModalOpen}
          questionStatement={currentQuestion.statement}
          submitting={reportSubmitting}
          onClose={() => setReportModalOpen(false)}
          onSubmit={submitQuestionReport}
        />
      )}

      {/* Paused overlay */}
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

      {/* Resume modal (crash / page reload recovery) */}
      {showResumeModal && resumeDraft && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4" role="dialog" aria-modal="true">
          <PixelCard className="w-full max-w-sm space-y-5 border-[var(--pixel-accent)]">
            <div>
              <p className="font-mono text-[10px] uppercase text-[var(--pixel-accent)]">Simulado em andamento</p>
              <h3 className="mt-2 font-[var(--font-body)] text-base">Deseja retomar de onde parou?</h3>
              <p className="mt-2 font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
                Questao {resumeDraft.currentIndex + 1} de {resumeDraft.questions.length} ·{" "}
                {Object.values(resumeDraft.answers).filter(Boolean).length} respondidas ·{" "}
                <span className="font-mono text-[var(--pixel-accent)]">{timerLabel}</span> restantes
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <PixelButton
                onClick={() => {
                  setQuestions(resumeDraft.questions);
                  setAnswers(resumeDraft.answers as StudyAnswerMap);
                  setCurrentIndex(resumeDraft.currentIndex);
                  setMarkedForReview(new Set(resumeDraft.markedForReview));
                  if (isPaused) resumeSession();
                  setShowResumeModal(false);
                  setResumeDraft(null);
                }}
                className="w-full justify-center"
              >
                Retomar de onde parei
              </PixelButton>
              <PixelButton
                variant="ghost"
                onClick={() => {
                  safeLocalStorageRemove(STORAGE_KEYS.simuladoDraft);
                  clearSession();
                  setShowResumeModal(false);
                  setResumeDraft(null);
                }}
                className="w-full justify-center"
              >
                Descartar e iniciar novo
              </PixelButton>
            </div>
          </PixelCard>
        </div>
      )}
    </main>
  );
}
