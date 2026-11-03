import { getAnswerOutcome, normalizeAnswerValue, normalizeOptionArray, normalizeQuestionType, isOptionKey } from "@/lib/study-answer-utils";
import type { StudyAnswerSnapshotPayload, StudyHistoryItem } from "@/features/study/services/study-api";
import type { StudyAnswerMap } from "@/features/study";
import type { StudyQuestion } from "@/lib/types";
import { resolveSessionKind, type ReviewCapabilities, type ReviewItem, type ReviewSession } from "./types";

type LiveSimuladoInput = {
  questions: StudyQuestion[];
  answers: StudyAnswerMap;
  title?: string;
  certificationCode?: string;
  timeSpentByQuestion?: Record<string, number>;
  confidenceByQuestion?: Record<string, "high" | "medium" | "low">;
  markedForReview?: Set<string>;
  explanationsByQuestion?: Record<string, { summary?: string; options?: Partial<Record<string, string>> }>;
  durationSeconds?: number;
  scorePercent?: number;
  gainedXp?: number;
};

function finish(items: ReviewItem[], session: ReviewSession): { items: ReviewItem[]; session: ReviewSession; capabilities: ReviewCapabilities } {
  return {
    items,
    session,
    capabilities: {
      hasTiming: items.some((item) => item.timeSpentSeconds !== undefined),
      hasConfidence: items.some((item) => item.confidence !== undefined),
      hasMarked: items.some((item) => item.markedForReview !== undefined),
      hasTopics: items.some((item) => Boolean(item.topic?.trim())),
    },
  };
}

export function fromLiveSimulado(input: LiveSimuladoInput) {
  const items = input.questions.map((question, index): ReviewItem => {
    const selected = normalizeAnswerValue(input.answers[question.id]);
    const correct = normalizeOptionArray(question.correctOptions);
    const answer = {
      questionType: question.questionType,
      selectedOptions: selected,
      correctOption: question.correctOption,
      correctOptions: correct,
    };
    const review = input.explanationsByQuestion?.[question.id];
    const options = (Object.entries(question.options) as Array<[string, string]>).map(([option, text]) => ({
      option,
      text,
      explanation: review?.options?.[option] ?? question.explanations[option as keyof typeof question.explanations] ?? "",
      isCorrect: correct.includes(option as never),
      isSelected: selected.includes(option as never),
    }));
    const correctOptionsText = options.filter((option) => option.isCorrect).map((option) => option.text);
    return {
      questionId: question.id,
      index,
      statement: question.statement,
      questionType: question.questionType,
      options,
      summary: review?.summary,
      outcome: getAnswerOutcome(answer),
      topic: question.topic,
      timeSpentSeconds: input.timeSpentByQuestion?.[question.id],
      confidence: input.confidenceByQuestion?.[question.id],
      markedForReview: input.markedForReview?.has(question.id),
      flashcardSeed: {
        questionId: question.id,
        statement: question.statement,
        correctOptionsText,
        correctExplanation: options.find((option) => option.isCorrect)?.explanation,
        topic: question.topic,
      },
    };
  });
  return finish(items, {
    kind: "SIMULADO",
    title: input.title ?? "Simulado",
    certificationCode: input.certificationCode,
    durationSeconds: input.durationSeconds,
    scorePercent: input.scorePercent,
    gainedXp: input.gainedXp,
  });
}

export function fromHistorySnapshot(
  snapshots: StudyAnswerSnapshotPayload[],
  session: Pick<StudyHistoryItem, "id" | "sessionType" | "title" | "certificationCode" | "completedAt" | "durationSeconds" | "scorePercent" | "gainedXp">,
) {
  const items = snapshots.map((snapshot, index): ReviewItem => {
    const questionType = normalizeQuestionType(snapshot.questionType);
    const selected = normalizeOptionArray(snapshot.selectedOptions).length
      ? normalizeOptionArray(snapshot.selectedOptions)
      : isOptionKey(snapshot.selectedOption) ? [snapshot.selectedOption] : [];
    const correct = normalizeOptionArray(snapshot.correctOptions).length
      ? normalizeOptionArray(snapshot.correctOptions)
      : normalizeOptionArray([snapshot.correctOption]);
    const options = Object.entries(snapshot.options).map(([option, rawText]) => ({
      option,
      text: rawText,
      explanation: snapshot.explanations[option] ?? "",
      isCorrect: correct.includes(option as never),
      isSelected: selected.includes(option as never),
    }));
    return {
      questionId: snapshot.questionId,
      index,
      statement: snapshot.statement,
      questionType,
      options,
      summary: snapshot.explanationSummary,
      outcome: getAnswerOutcome({ questionType, selectedOption: snapshot.selectedOption, selectedOptions: snapshot.selectedOptions, correctOption: snapshot.correctOption, correctOptions: snapshot.correctOptions }),
      topic: snapshot.topic,
      timeSpentSeconds: snapshot.timeSpentSeconds,
      confidence: snapshot.confidence,
      markedForReview: snapshot.markedForReview,
      removedFromBank: snapshot.removedFromBank,
      flashcardSeed: {
        questionId: snapshot.questionId,
        statement: snapshot.statement,
        correctOptionsText: options.filter((option) => option.isCorrect).map((option) => option.text),
        correctExplanation: options.find((option) => option.isCorrect)?.explanation,
        topic: snapshot.topic,
      },
    };
  });
  return finish(items, {
    kind: resolveSessionKind(session.sessionType, session.title),
    historyId: session.id,
    title: session.title,
    certificationCode: session.certificationCode,
    completedAt: session.completedAt,
    durationSeconds: session.durationSeconds,
    scorePercent: session.scorePercent,
    gainedXp: session.gainedXp,
  });
}
