import { QuestionOption } from "@/lib/types";

export type StudyExplanationResult = {
  summary: string;
  options: Partial<Record<QuestionOption, string>>;
};

export type StudyAnswerMap = Record<string, QuestionOption | undefined>;
