import { QuestionOptionMapping, StudyQuestion } from "@/lib/types";
import { StudyQuestion as DbStudyQuestion } from "@prisma/client";

type OptionKey = "A" | "B" | "C" | "D" | "E";

type DbQuestionWithRelations = DbStudyQuestion & {
  certificationPreset?: { code: string } | null;
  awsService?: { code: string; name: string } | null;
};

function toOptionKey(value: string): OptionKey {
  if (value === "A" || value === "B" || value === "C" || value === "D" || value === "E") {
    return value;
  }
  return "A";
}

function shuffleArray<T>(items: T[]): T[] {
  const cloned = [...items];
  for (let index = cloned.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [cloned[index], cloned[randomIndex]] = [cloned[randomIndex], cloned[index]];
  }
  return cloned;
}

export function mapDbQuestionToStudyQuestion(question: DbQuestionWithRelations): StudyQuestion {
  const originalCorrect = toOptionKey(question.correctOption);
  const rawOptions: Array<{ key: OptionKey; text: string; explanation: string }> = [
    { key: "A", text: question.optionA, explanation: question.explanationA ?? "" },
    { key: "B", text: question.optionB, explanation: question.explanationB ?? "" },
    { key: "C", text: question.optionC, explanation: question.explanationC ?? "" },
    { key: "D", text: question.optionD, explanation: question.explanationD ?? "" },
    { key: "E", text: question.optionE ?? "", explanation: question.explanationE ?? "" },
  ];
  const originalOptions = rawOptions.filter((option) => option.text.trim().length > 0);

  const shuffled = shuffleArray(originalOptions);
  const targetKeys: OptionKey[] = ["A", "B", "C", "D", "E"];

  const nextOptions: Record<OptionKey, string> = {
    A: "",
    B: "",
    C: "",
    D: "",
    E: "",
  };

  const nextExplanations: Partial<Record<OptionKey, string>> = {};
  const optionMapping: QuestionOptionMapping = {
    displayToOriginal: {},
    originalToDisplay: {},
  };
  let nextCorrect: OptionKey = "A";

  shuffled.forEach((option, index) => {
    const mappedKey = targetKeys[index] ?? "E";
    nextOptions[mappedKey] = option.text;
    nextExplanations[mappedKey] = option.explanation;
    optionMapping.displayToOriginal[mappedKey] = option.key;
    optionMapping.originalToDisplay[option.key] = mappedKey;

    if (option.key === originalCorrect) {
      nextCorrect = mappedKey;
    }
  });

  return {
    id: question.id,
    statement: question.statement,
    certificationCode: question.certificationPreset?.code ?? "",
    topic: question.awsService?.name ?? question.topic,
    difficulty: question.difficulty,
    options: nextOptions,
    correctOption: nextCorrect,
    explanations: nextExplanations,
    optionMapping,
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
