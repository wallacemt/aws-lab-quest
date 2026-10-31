import type { AnswerOutcome } from "@/lib/study-answer-utils";

export type ReviewItem = {
  questionId: string;
  index: number;
  statement: string;
  questionType: "single" | "multi";
  options: Array<{
    option: string;
    text: string;
    explanation: string;
    isCorrect: boolean;
    isSelected: boolean;
  }>;
  summary?: string;
  outcome: AnswerOutcome;
  topic?: string;
  timeSpentSeconds?: number;
  confidence?: "high" | "medium" | "low";
  markedForReview?: boolean;
  removedFromBank?: boolean;
  flashcardSeed: {
    questionId: string;
    statement: string;
    correctOptionsText: string[];
    correctExplanation?: string;
    topic?: string;
  };
};

export type ReviewSession = {
  kind: "SIMULADO" | "KC" | "SPRINT" | "ARENA" | "QUIZ_DIARIO";
  historyId?: string;
  title: string;
  certificationCode?: string | null;
  completedAt?: string;
  durationSeconds?: number | null;
  scorePercent?: number;
  gainedXp?: number;
};

export type ReviewCapabilities = {
  hasTiming: boolean;
  hasConfidence: boolean;
  hasMarked: boolean;
  hasTopics: boolean;
};

export type ReviewFilters = {
  outcome: "all" | "correct" | "partial" | "wrong";
  topic: string;
  time: "all" | "fast" | "slow";
  confidence: "all" | "false-belief" | "lucky-guess";
  markedOnly: boolean;
};

export function resolveSessionKind(sessionType: string, title: string): ReviewSession["kind"] {
  if (sessionType === "SIMULADO") return "SIMULADO";
  if (title.startsWith("Sprint ")) return "SPRINT";
  if (title.startsWith("Boss Battle: ")) return "ARENA";
  if (title.startsWith("Quiz Diário — ")) return "QUIZ_DIARIO";
  return "KC";
}
