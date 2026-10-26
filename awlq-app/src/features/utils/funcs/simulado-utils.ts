import { StudyAnswerMap } from "@/features/study";
import { isAnswerCorrect } from "@/features/study/services";
import { QuestionOption, StudyQuestion } from "@/lib/types";
import { ScoreOverviewData, TopicPerformance } from "@/types/questions";
import type { AnswerConfidence } from "@/features/retention/components/ConfidenceSelector";

export type SimuladoReviewFilters = {
  result: "all" | "correct" | "wrong";
  topic: string;
  time: "all" | "fast" | "slow";
  markedOnly: boolean;
  confidence: "all" | "false-belief" | "lucky-guess";
};

export function getAverageQuestionTime(questions: StudyQuestion[], times: Record<string, number>): number {
  return questions.length ? questions.reduce((sum, question) => sum + (times[question.id] ?? 0), 0) / questions.length : 0;
}

export function filterSimuladoReviewQuestions(
  questions: StudyQuestion[], answers: StudyAnswerMap, times: Record<string, number>, marked: Set<string>,
  confidenceByQuestion: Record<string, AnswerConfidence>, filters: SimuladoReviewFilters,
): StudyQuestion[] {
  const average = getAverageQuestionTime(questions, times);
  return questions.filter((question) => {
    const correct = isAnswerCorrect({ questionType: question.questionType, answer: answers[question.id], correctOption: question.correctOption, correctOptions: question.correctOptions });
    const seconds = times[question.id] ?? 0;
    const confidence = confidenceByQuestion[question.id];
    return (filters.result === "all" || (filters.result === "correct") === correct) &&
      (filters.topic === "all" || (question.topic?.trim() || "OUTROS") === filters.topic) &&
      (filters.time === "all" || (filters.time === "fast" ? seconds < average * 0.5 : seconds > average * 1.5)) &&
      (!filters.markedOnly || marked.has(question.id)) &&
      (filters.confidence === "all" || (filters.confidence === "false-belief" ? !correct && confidence === "high" : correct && confidence === "low"));
  });
}

export function hasSubstantialStaticExplanation(explanation: string | undefined): boolean {
  return (explanation?.trim().length ?? 0) >= 40;
}


export function formatTime(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const mm = Math.floor(clamped / 60)
    .toString()
    .padStart(2, "0");
  const ss = (clamped % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

export function playAlarmBeep() {
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

export function playSuccessSound() {
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

export function playDefeatSound() {
  try {
    const ctx = new AudioContext();
    const notes = [392, 349, 294, 220];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = "sawtooth";
      gain.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.22);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.22 + 0.35);
      osc.start(ctx.currentTime + i * 0.22);
      osc.stop(ctx.currentTime + i * 0.22 + 0.35);
    });
  } catch {
    // Web Audio API não disponível
  }
}

export async function triggerConfetti() {
  try {
    const confetti = (await import("canvas-confetti")).default;
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, zIndex: 9999 });
    setTimeout(() => confetti({ particleCount: 60, spread: 120, origin: { x: 0.1, y: 0.5 }, zIndex: 9999 }), 300);
    setTimeout(() => confetti({ particleCount: 60, spread: 120, origin: { x: 0.9, y: 0.5 }, zIndex: 9999 }), 500);
  } catch {
    // canvas-confetti não disponível
  }
}

export function buildTopicPerformance(questions: StudyQuestion[], answers: StudyAnswerMap): TopicPerformance[] {
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
      correctOption: question.correctOption as QuestionOption,
      correctOptions: question.correctOptions as QuestionOption[],
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

export function buildScoreOverview(correct: number, total: number, topicPerformance: TopicPerformance[], passingScorePercent = 70): ScoreOverviewData {
  const maxPoints = 1000;
  const minimumCertificationPoints = Math.round(passingScorePercent * 10);
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
