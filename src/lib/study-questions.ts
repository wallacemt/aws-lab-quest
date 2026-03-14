import { StudyQuestion } from "@/lib/types";
import { StudyQuestion as DbStudyQuestion } from "@prisma/client";

type DbQuestionWithRelations = DbStudyQuestion & {
  certificationPreset?: { code: string } | null;
  awsService?: { code: string; name: string } | null;
};

function toOptionKey(value: string): "A" | "B" | "C" | "D" | "E" {
  if (value === "A" || value === "B" || value === "C" || value === "D" || value === "E") {
    return value;
  }
  return "A";
}

export function mapDbQuestionToStudyQuestion(question: DbQuestionWithRelations): StudyQuestion {
  return {
    id: question.id,
    statement: question.statement,
    certificationCode: question.certificationPreset?.code ?? "",
    topic: question.awsService?.name ?? question.topic,
    difficulty: question.difficulty,
    options: {
      A: question.optionA,
      B: question.optionB,
      C: question.optionC,
      D: question.optionD,
      E: question.optionE ?? "",
    },
    correctOption: toOptionKey(question.correctOption),
    explanations: {
      A: question.explanationA ?? "",
      B: question.explanationB ?? "",
      C: question.explanationC ?? "",
      D: question.explanationD ?? "",
      E: question.explanationE ?? "",
    },
  };
}

export function pickRandomItems<T>(items: T[], count: number): T[] {
  const cloned = [...items];
  for (let i = cloned.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [cloned[i], cloned[j]] = [cloned[j], cloned[i]];
  }
  return cloned.slice(0, Math.max(0, Math.min(count, cloned.length)));
}
