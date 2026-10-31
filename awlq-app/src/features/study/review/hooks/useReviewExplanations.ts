"use client";

import { useCallback, useRef, useState } from "react";
import { createStudyExplanation, saveStudyHistoryExplanation } from "@/features/study/services";
import { hasSubstantialStaticExplanation } from "@/features/utils/funcs/simulado-utils";
import type { StudyAnswerSnapshotPayload } from "@/features/study/services/study-api";
import type { QuestionOption } from "@/lib/types";

type ExplanationCacheItem = { summary: string; options: Partial<Record<QuestionOption, string>> };

export function useReviewExplanations({ historyId, readOnly = false }: { historyId?: string; readOnly?: boolean }) {
  const [loadingByQuestion, setLoadingByQuestion] = useState<Record<string, boolean>>({});
  const [failedByQuestion, setFailedByQuestion] = useState<Record<string, boolean>>({});
  const [removedFromBank, setRemovedFromBank] = useState<Record<string, boolean>>({});
  const [cacheByQuestion, setCacheByQuestion] = useState<Record<string, ExplanationCacheItem>>({});
  const inFlight = useRef<Record<string, boolean>>({});

  const generate = useCallback(async (
    item: StudyAnswerSnapshotPayload,
    update: (questionId: string, summary: string, options: Partial<Record<QuestionOption, string>>) => void,
  ) => {
    const questionId = item.questionId;
    if (readOnly || !historyId || inFlight.current[questionId] || failedByQuestion[questionId]) return;
    if (item.explanationSummary?.trim() || hasSubstantialStaticExplanation(item.explanations[item.correctOption])) return;
    inFlight.current[questionId] = true;
    setLoadingByQuestion((state) => ({ ...state, [questionId]: true }));
    try {
      const selectedOptions = Array.isArray(item.selectedOptions)
        ? item.selectedOptions.filter((option): option is QuestionOption => ["A", "B", "C", "D", "E"].includes(option))
        : [];
      const selectedOption = ["A", "B", "C", "D", "E"].includes(item.selectedOption)
        ? item.selectedOption as QuestionOption
        : selectedOptions[0] ?? "A";
      const generated = await createStudyExplanation({
        questionId,
        selectedOption,
        selectedOptions: item.questionType === "multi" ? selectedOptions : undefined,
        optionMapping: item.optionMapping,
      });
      setCacheByQuestion((state) => ({ ...state, [questionId]: generated }));
      update(questionId, generated.summary, generated.options);
      await saveStudyHistoryExplanation({ historyId, questionId, explanationSummary: generated.summary, explanations: generated.options });
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      if (message.includes("nao encontrada") || message.includes("não encontrada") || message.includes("not found")) {
        setRemovedFromBank((state) => ({ ...state, [questionId]: true }));
      }
      const fallback = { summary: "Revisao local baseada no gabarito da questao.", options: item.explanations as Partial<Record<QuestionOption, string>> };
      setFailedByQuestion((state) => ({ ...state, [questionId]: true }));
      setCacheByQuestion((state) => ({ ...state, [questionId]: fallback }));
      update(questionId, item.explanationSummary || fallback.summary, {});
    } finally {
      inFlight.current[questionId] = false;
      setLoadingByQuestion((state) => ({ ...state, [questionId]: false }));
    }
  }, [failedByQuestion, historyId, readOnly]);

  const retry = useCallback((questionId: string) => {
    inFlight.current[questionId] = false;
    setFailedByQuestion((state) => { const next = { ...state }; delete next[questionId]; return next; });
    setCacheByQuestion((state) => { const next = { ...state }; delete next[questionId]; return next; });
  }, []);

  return { loadingByQuestion, failedByQuestion, removedFromBank, cacheByQuestion, generate, retry };
}
