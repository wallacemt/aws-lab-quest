import {
  isCorrectAnswer,
  normalizeAnswerValue,
  normalizeOptionArray,
  normalizeQuestionType,
} from "@/lib/study-answer-utils";
import { QuestionOption, StudyAnswerValue, StudyQuestion, StudyQuestionType } from "@/lib/types";

export function normalizeCorrectOptions(
  question: Pick<StudyQuestion, "questionType" | "correctOption" | "correctOptions">,
): QuestionOption[] {
  const normalized = normalizeOptionArray(question.correctOptions);
  if (normalized.length > 0) {
    return normalized;
  }

  if (
    question.correctOption === "A" ||
    question.correctOption === "B" ||
    question.correctOption === "C" ||
    question.correctOption === "D" ||
    question.correctOption === "E"
  ) {
    return [question.correctOption];
  }

  return ["A"];
}

export function inferQuestionType(value: unknown): StudyQuestionType {
  return normalizeQuestionType(value);
}

export { normalizeAnswerValue };

export function isAnswerCorrect(params: {
  questionType: StudyQuestionType;
  answer: StudyAnswerValue | undefined;
  correctOption: QuestionOption;
  correctOptions: QuestionOption[];
}): boolean {
  const selected = normalizeAnswerValue(params.answer);
  return isCorrectAnswer({
    questionType: params.questionType,
    selectedOption: selected[0],
    selectedOptions: selected,
    correctOption: params.correctOption,
    correctOptions: params.correctOptions,
  });
}
