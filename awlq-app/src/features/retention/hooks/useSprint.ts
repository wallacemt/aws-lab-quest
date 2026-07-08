"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  SprintData,
  SprintQuestion,
  SprintResult,
  fetchSprintQuestions,
  submitSprint,
} from "@/features/retention/services/retention-api";
import { QuestionOption } from "@/lib/types";

type SprintMode = "s3" | "s5" | "s10";

/** Drops unanswered questions and maps to the server's {questionId, selectedOption} contract. */
export function buildSprintPayload(questions: SprintQuestion[], answers: Record<string, QuestionOption>) {
  return questions
    .filter((q) => answers[q.id])
    .map((q) => ({ questionId: q.id, selectedOption: answers[q.id] }));
}

type UseSprintState = {
  data: SprintData | null;
  answers: Record<string, QuestionOption>;
  currentIndex: number;
  submitted: boolean;
  result: SprintResult | null;
  isLoading: boolean;
  isSubmitting: boolean;
  isDone: boolean;
  error: string | null;
  timeLeft: number | null;
};

type UseSprintActions = {
  start: (mode: SprintMode) => Promise<void>;
  selectAnswer: (questionId: string, option: QuestionOption) => void;
  goToQuestion: (index: number) => void;
  finish: () => Promise<void>;
  cancel: () => void;
};

export function useSprint(): UseSprintState & UseSprintActions {
  const [data, setData] = useState<SprintData | null>(null);
  const [answers, setAnswers] = useState<Record<string, QuestionOption>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<SprintResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  // Refs let finish()/the countdown read latest state without re-triggering the timer effect.
  const dataRef = useRef<SprintData | null>(null);
  const answersRef = useRef<Record<string, QuestionOption>>({});
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const finish = useCallback(async () => {
    const currentData = dataRef.current;
    if (!currentData || submitted) return;

    const payload = buildSprintPayload(currentData.questions, answersRef.current);
    if (payload.length === 0) return;

    if (timerRef.current) clearInterval(timerRef.current);
    setSubmitted(true);
    setIsSubmitting(true);
    try {
      const sprintResult = await submitSprint(payload, currentData.mode);
      setResult(sprintResult);
      setIsDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar sprint.");
    } finally {
      setIsSubmitting(false);
    }
  }, [submitted]);

  // Whole-session countdown; auto-submits at zero.
  useEffect(() => {
    if (!data?.limitSeconds || submitted) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null || prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          void finish();
          return 0;
        }
        return prev - 1;
      });
    }, 1_000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [data, submitted, finish]);

  const start = useCallback(async (mode: SprintMode) => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    setIsDone(false);
    setSubmitted(false);
    setAnswers({});
    setCurrentIndex(0);
    try {
      const sprintData = await fetchSprintQuestions(mode);
      setData(sprintData);
      setTimeLeft(sprintData.limitSeconds);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar sprint.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const selectAnswer = useCallback((questionId: string, option: QuestionOption) => {
    setAnswers((prev) => ({ ...prev, [questionId]: option }));
  }, []);

  const goToQuestion = useCallback((index: number) => {
    const total = dataRef.current?.questions.length ?? 0;
    if (index < 0 || index >= total) return;
    setCurrentIndex(index);
  }, []);

  // Abandons the current session and returns to mode selection — nothing is submitted.
  const cancel = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setData(null);
    setAnswers({});
    setCurrentIndex(0);
    setSubmitted(false);
    setResult(null);
    setIsDone(false);
    setTimeLeft(null);
    setError(null);
  }, []);

  return {
    data,
    answers,
    currentIndex,
    submitted,
    result,
    isLoading,
    isSubmitting,
    isDone,
    error,
    timeLeft,
    start,
    selectAnswer,
    goToQuestion,
    finish,
    cancel,
  };
}
