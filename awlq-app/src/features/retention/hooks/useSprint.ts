"use client";

import { useState, useCallback } from "react";
import {
  SprintData,
  SprintResult,
  fetchSprintQuestions,
  submitSprint,
} from "@/features/retention/services/retention-api";

type SprintMode = "q5" | "q10" | "t3" | "t5";

type AnswerRecord = { questionId: string; correct: boolean };

type UseSprintState = {
  data: SprintData | null;
  currentIndex: number;
  answers: AnswerRecord[];
  result: SprintResult | null;
  isLoading: boolean;
  isSubmitting: boolean;
  isDone: boolean;
  error: string | null;
};

type UseSprintActions = {
  start: (mode: SprintMode) => Promise<void>;
  recordAnswer: (questionId: string, correct: boolean) => Promise<void>;
};

export function useSprint(): UseSprintState & UseSprintActions {
  const [data, setData] = useState<SprintData | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [result, setResult] = useState<SprintResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async (mode: SprintMode) => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    setIsDone(false);
    setAnswers([]);
    setCurrentIndex(0);
    try {
      const sprintData = await fetchSprintQuestions(mode);
      setData(sprintData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar sprint.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const recordAnswer = useCallback(
    async (questionId: string, correct: boolean) => {
      if (!data) return;

      const updatedAnswers = [...answers, { questionId, correct }];
      const nextIndex = currentIndex + 1;
      const isLast = nextIndex >= data.questions.length;

      setAnswers(updatedAnswers);
      setCurrentIndex(nextIndex);

      if (isLast) {
        setIsSubmitting(true);
        try {
          const sprintResult = await submitSprint(updatedAnswers, data.mode);
          setResult(sprintResult);
          setIsDone(true);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Erro ao enviar sprint.");
        } finally {
          setIsSubmitting(false);
        }
      }
    },
    [data, currentIndex, answers],
  );

  return {
    data,
    currentIndex,
    answers,
    result,
    isLoading,
    isSubmitting,
    isDone,
    error,
    start,
    recordAnswer,
  };
}
