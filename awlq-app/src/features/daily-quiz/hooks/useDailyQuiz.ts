"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DailyQuizAlreadyDoneError,
  DailyQuizQuestion,
  fetchDailyQuiz,
  submitDailyQuiz,
} from "@/features/daily-quiz/services/daily-quiz-api";
import { QuestionOption } from "@/lib/types";

const OPTION_KEYS: QuestionOption[] = ["A", "B", "C", "D", "E"];

type DailyQuizState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "locked"; reason: string }
  | { status: "no-quiz" }
  | { status: "completed"; score: number; totalCount: number; gainedXp: number; completedAt: string }
  | { status: "ready"; quizId: string; questions: DailyQuizQuestion[] }
  | {
      status: "submitted";
      score: number;
      totalCount: number;
      gainedXp: number;
      historyId: string;
      newAchievements: { code: string; name: string; description: string }[];
    };

export function useDailyQuiz() {
  const [state, setState] = useState<DailyQuizState>({ status: "loading" });
  const [answers, setAnswers] = useState<Record<string, QuestionOption>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = useCallback(async () => {
    setState({ status: "loading" });
    setAnswers({});
    setCurrentIndex(0);
    try {
      const data = await fetchDailyQuiz();
      if (data.locked) {
        setState({ status: "locked", reason: data.reason });
        return;
      }
      if (data.completed) {
        setState({ status: "completed", ...data.attempt });
        return;
      }
      if (!data.quiz) {
        setState({ status: "no-quiz" });
        return;
      }
      setState({ status: "ready", quizId: data.quiz.id, questions: data.quiz.questions });
    } catch (err) {
      setState({ status: "error", message: err instanceof Error ? err.message : "Erro ao carregar o quiz diario." });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selectAnswer = useCallback((questionId: string, option: QuestionOption) => {
    setAnswers((prev) => ({ ...prev, [questionId]: option }));
  }, []);

  const goToQuestion = useCallback(
    (index: number) => {
      if (state.status !== "ready") return;
      if (index < 0 || index >= state.questions.length) return;
      setCurrentIndex(index);
    },
    [state],
  );

  const submit = useCallback(async () => {
    if (state.status !== "ready") return;
    const payload = state.questions
      .filter((q) => answers[q.id])
      .map((q) => ({ questionId: q.id, selectedOption: OPTION_KEYS.indexOf(answers[q.id]) }));
    if (payload.length < state.questions.length) return;

    setIsSubmitting(true);
    try {
      const result = await submitDailyQuiz(payload);
      setState({ status: "submitted", ...result });
    } catch (err) {
      const message = err instanceof DailyQuizAlreadyDoneError ? err.message : err instanceof Error ? err.message : "Erro ao enviar respostas.";
      setState({ status: "error", message });
    } finally {
      setIsSubmitting(false);
    }
  }, [state, answers]);

  return { state, answers, currentIndex, isSubmitting, selectAnswer, goToQuestion, submit, reload: load };
}
