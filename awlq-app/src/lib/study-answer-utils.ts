import { QuestionOption, StudyAnswerValue, StudyQuestionType } from "@/lib/types";

export function isOptionKey(value: unknown): value is QuestionOption {
  return value === "A" || value === "B" || value === "C" || value === "D" || value === "E";
}

export function normalizeOptionArray(value: unknown): QuestionOption[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const deduped = new Set<QuestionOption>();
  for (const item of value) {
    if (isOptionKey(item)) {
      deduped.add(item);
    }
  }

  return Array.from(deduped).sort();
}

export function normalizeAnswerValue(value: StudyAnswerValue | undefined): QuestionOption[] {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return normalizeOptionArray(value);
  }

  return isOptionKey(value) ? [value] : [];
}

export function normalizeQuestionType(value: unknown): StudyQuestionType {
  return value === "multi" ? "multi" : "single";
}

export function isCorrectAnswer(params: {
  questionType: StudyQuestionType;
  selectedOption?: unknown;
  selectedOptions?: unknown;
  correctOption?: unknown;
  correctOptions?: unknown;
}): boolean {
  const expected = normalizeOptionArray(params.correctOptions);
  const fallbackCorrect = isOptionKey(params.correctOption) ? params.correctOption : "A";
  const normalizedExpected = expected.length > 0 ? expected : [fallbackCorrect];

  const selectedArray = normalizeOptionArray(params.selectedOptions);
  const selected =
    selectedArray.length > 0 ? selectedArray : isOptionKey(params.selectedOption) ? [params.selectedOption] : [];

  if (params.questionType !== "multi") {
    return selected.length === 1 && selected[0] === normalizedExpected[0];
  }

  if (selected.length !== normalizedExpected.length) {
    return false;
  }

  return normalizedExpected.every((option, index) => option === selected[index]);
}
