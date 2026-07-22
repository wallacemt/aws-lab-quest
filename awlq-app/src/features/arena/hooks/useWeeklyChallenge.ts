"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchWeeklyChallenge,
  fetchWeeklyChallengeQuestions,
  submitWeeklyChallenge,
  type WeeklyChallengeData,
  type WeeklyChallengeQuestion,
} from "@/features/arena/services/arena-api";
import { useRealtimeWeeklyChallenge } from "@/hooks/useRealtimeLeaderboard";
import { QuestionOption } from "@/lib/types";

const OPTION_KEYS: QuestionOption[] = ["A", "B", "C", "D", "E"];

type WeeklyChallengeState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "idle"; data: WeeklyChallengeData }
  | { status: "starting"; data: WeeklyChallengeData }
  | { status: "in-progress"; data: WeeklyChallengeData; questions: WeeklyChallengeQuestion[] }
  | {
      status: "submitted";
      data: WeeklyChallengeData;
      score: number;
      gainedXp: number;
      historyId: string;
      newAchievements: { code: string; name: string; description: string }[];
    };

export function useWeeklyChallenge() {
  const [state, setState] = useState<WeeklyChallengeState>({ status: "loading" });
  const [answers, setAnswers] = useState<Record<string, QuestionOption>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchWeeklyChallenge();
      setState({ status: "idle", data });
    } catch (err) {
      setState({ status: "error", message: err instanceof Error ? err.message : "Erro ao carregar desafio." });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Silently refresh the card/leaderboard in the background on broadcast — never
  // while a quiz is in progress, since questions/answers live outside `state.data`.
  useRealtimeWeeklyChallenge(
    useCallback(() => {
      setState((prev) => {
        if (prev.status === "idle" || prev.status === "submitted") void load();
        return prev;
      });
    }, [load]),
  );

  const start = useCallback(async () => {
    if (state.status !== "idle" || !state.data.challenge) return;
    const { data } = state;
    setState({ status: "starting", data });
    setAnswers({});
    setCurrentIndex(0);
    try {
      const questions = await fetchWeeklyChallengeQuestions();
      setState({ status: "in-progress", data, questions });
    } catch (err) {
      setState({ status: "error", message: err instanceof Error ? err.message : "Erro ao carregar questoes." });
    }
  }, [state]);

  const selectAnswer = useCallback((questionId: string, option: QuestionOption) => {
    setAnswers((prev) => ({ ...prev, [questionId]: option }));
  }, []);

  const goToQuestion = useCallback(
    (index: number) => {
      if (state.status !== "in-progress") return;
      if (index < 0 || index >= state.questions.length) return;
      setCurrentIndex(index);
    },
    [state],
  );

  const submit = useCallback(async () => {
    if (state.status !== "in-progress") return;
    const payload = state.questions
      .filter((q) => answers[q.id])
      .map((q) => ({ questionId: q.id, selectedOption: OPTION_KEYS.indexOf(answers[q.id]) }));
    if (payload.length < state.questions.length) return;

    setIsSubmitting(true);
    try {
      const result = await submitWeeklyChallenge(payload);
      const updated = await fetchWeeklyChallenge();
      setState({
        status: "submitted",
        data: updated,
        score: result.score,
        gainedXp: result.gainedXp,
        historyId: result.historyId,
        newAchievements: result.newAchievements ?? [],
      });
    } catch (err) {
      setState({ status: "error", message: err instanceof Error ? err.message : "Erro ao enviar respostas." });
    } finally {
      setIsSubmitting(false);
    }
  }, [state, answers]);

  return { state, answers, currentIndex, isSubmitting, start, selectAnswer, goToQuestion, submit, reload: load };
}
