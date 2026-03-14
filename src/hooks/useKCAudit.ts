"use client";

import { useMemo, useState } from "react";
import { KC_QUESTIONS } from "@/lib/question-bank";
import { QuestionOption, StudyQuestion } from "@/lib/types";

type AnswerState = Record<string, QuestionOption | undefined>;

export function useKCAudit() {
  const [answers, setAnswers] = useState<AnswerState>({});

  const questions = KC_QUESTIONS;

  const stats = useMemo(() => {
    const answered = questions.filter((q) => answers[q.id]).length;
    const correct = questions.filter((q) => answers[q.id] && answers[q.id] === q.correctOption).length;

    return {
      answered,
      total: questions.length,
      correct,
      wrong: Math.max(0, answered - correct),
    };
  }, [answers, questions]);

  function answerQuestion(questionId: string, option: QuestionOption) {
    setAnswers((prev) => ({ ...prev, [questionId]: option }));
  }

  function reset() {
    setAnswers({});
  }

  function getQuestionResult(question: StudyQuestion) {
    const selected = answers[question.id];
    if (!selected) return { selected: null, isCorrect: null };

    return {
      selected,
      isCorrect: selected === question.correctOption,
    };
  }

  return {
    questions,
    answers,
    stats,
    answerQuestion,
    getQuestionResult,
    reset,
  };
}
