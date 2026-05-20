"use client";

import { createContext, Dispatch, SetStateAction, useContext } from "react";
import { StudyAnswerMap, StudyExplanationResult } from "@/features/study";
import { QuestionOption, StudyQuestion } from "@/lib/types";

export type WeakServiceMetric = {
  topic: string;
  attempts: number;
  errors: number;
  correct: number;
  errorRate: number;
};

export type ReviewOption = {
  option: QuestionOption;
  text: string;
  explanation: string;
  isCorrect: boolean;
  isSelected: boolean;
};

export type ReportReason =
  | "INCORRECT_ANSWER"
  | "UNCLEAR_STATEMENT"
  | "MISSING_CONTEXT"
  | "GRAMMAR_TYPO"
  | "DUPLICATE"
  | "QUALITY_ISSUE"
  | "OTHER";

export type ExamSession = {
  id: string;
  certificationCode: string;
  startedAt: string;
  endsAt: string;
};

export type SimuladoContextType = {
  // Core exam state
  questions: StudyQuestion[];
  answers: StudyAnswerMap;
  currentIndex: number;
  submitted: boolean;
  inExamFlow: boolean;
  inReviewFlow: boolean;
  isActive: boolean;
  currentQuestion: StudyQuestion | null;
  answeredCount: number;

  // Timer / session
  timerLabel: string;
  session: ExamSession | null;

  // UI state
  focusMode: boolean;
  isPaused: boolean;
  markedForReview: Set<string>;
  allQuestionsAnswered: boolean;
  reportModalOpen: boolean;
  reportMessage: string | null;
  reportSubmitting: boolean;
  showPreSubmitSummary: boolean;

  // Review (derived, pre-computed in screen)
  currentReview: StudyExplanationResult | undefined;
  currentReviewOptions: ReviewOption[];
  loadingReviewByQuestion: Record<string, boolean>;

  // Weak-services sidebar
  historicalWeakServices: WeakServiceMetric[];
  loadingWeakServices: boolean;
  weakServicesCurrentExam: WeakServiceMetric[];
  strongestGapTopics: string[];

  // Setters
  setAnswers: Dispatch<SetStateAction<StudyAnswerMap>>;
  setFocusMode: Dispatch<SetStateAction<boolean>>;
  setReportModalOpen: Dispatch<SetStateAction<boolean>>;
  setShowPreSubmitSummary: Dispatch<SetStateAction<boolean>>;

  // Actions
  goToQuestion: (index: number) => Promise<void>;
  toggleMarkForReview: (questionId: string) => void;
  handleForceExit: () => void;
  handleReset: () => void;
  handleSubmitExam: () => Promise<void>;
  submitQuestionReport: (input: { reason: ReportReason; description: string }) => Promise<void>;
  resumeSession: () => void;
  pauseSession: () => void;

  // Navigation (router-backed, defined in screen)
  navigateHome: () => void;
  navigateToKcGaps: () => void;
  navigateToLabGaps: () => void;
};

export const SimuladoContext = createContext<SimuladoContextType | null>(null);

export function useSimuladoContext(): SimuladoContextType {
  const ctx = useContext(SimuladoContext);
  if (!ctx) throw new Error("useSimuladoContext must be used within SimuladoContext.Provider");
  return ctx;
}
