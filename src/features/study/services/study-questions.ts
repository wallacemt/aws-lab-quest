import { QuestionOptionMapping, StudyQuestion } from "@/lib/types";
import { hasRenderableOptionText, normalizeOptionText } from "@/lib/study-option-text";
import { StudyQuestion as DbStudyQuestion } from "@prisma/client";

type OptionKey = "A" | "B" | "C" | "D" | "E";

type DbQuestionWithRelations = DbStudyQuestion & {
  certificationPreset?: { code: string } | null;
  awsService?: { code: string; name: string } | null;
  questionOptions?: Array<{
    order: number;
    content: string;
    isCorrect: boolean;
    explanation: string | null;
  }>;
  questionAwsServices?: Array<{
    service: {
      code: string;
      name: string;
    };
  }>;
};

function toOptionKey(value: string): OptionKey {
  if (value === "A" || value === "B" || value === "C" || value === "D" || value === "E") {
    return value;
  }
  return "A";
}

function toQuestionType(value: unknown): "single" | "multi" {
  return value === "multi" ? "multi" : "single";
}

function toOptionKeys(values: unknown): OptionKey[] {
  if (!Array.isArray(values)) {
    return [];
  }

  const deduped = new Set<OptionKey>();
  for (const item of values) {
    if (item === "A" || item === "B" || item === "C" || item === "D" || item === "E") {
      deduped.add(item);
    }
  }

  return Array.from(deduped);
}

function shuffleArray<T>(items: T[]): T[] {
  const cloned = [...items];
  for (let index = cloned.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [cloned[index], cloned[randomIndex]] = [cloned[randomIndex], cloned[index]];
  }
  return cloned;
}

function buildRawOptionsFrame(question: DbQuestionWithRelations): {
  rawOptions: Array<{ key: OptionKey; text: string; explanation: string }>;
  originalCorrect: OptionKey;
  originalCorrectOptions: OptionKey[];
} {
  const orderedNormalized = Array.isArray(question.questionOptions)
    ? [...question.questionOptions].sort((a, b) => a.order - b.order).slice(0, 5)
    : [];

  if (orderedNormalized.length >= 2) {
    const targetKeys: OptionKey[] = ["A", "B", "C", "D", "E"];
    const rawOptions = orderedNormalized
      .map((option, index) => {
        const key = targetKeys[index];
        if (!key) {
          return null;
        }

        return {
          key,
          text: normalizeOptionText(option.content),
          explanation: option.explanation ?? "",
        };
      })
      .filter((option): option is { key: OptionKey; text: string; explanation: string } => option !== null);

    const originalCorrectOptions = orderedNormalized
      .map((option, index) => ({ option, key: targetKeys[index] }))
      .filter((item) => Boolean(item.key))
      .filter((item) => item.option.isCorrect)
      .map((item) => item.key as OptionKey);

    const originalCorrect = originalCorrectOptions[0] ?? "A";
    return {
      rawOptions,
      originalCorrect,
      originalCorrectOptions,
    };
  }

  const originalCorrect = toOptionKey(question.correctOption);
  const rawCorrectOptions = (question as DbStudyQuestion & { correctOptions?: unknown }).correctOptions;
  const originalCorrectOptions = toOptionKeys(rawCorrectOptions);
  if (originalCorrectOptions.length === 0) {
    originalCorrectOptions.push(originalCorrect);
  }

  const rawOptions: Array<{ key: OptionKey; text: string; explanation: string }> = [
    { key: "A", text: normalizeOptionText(question.optionA), explanation: question.explanationA ?? "" },
    { key: "B", text: normalizeOptionText(question.optionB), explanation: question.explanationB ?? "" },
    { key: "C", text: normalizeOptionText(question.optionC), explanation: question.explanationC ?? "" },
    { key: "D", text: normalizeOptionText(question.optionD), explanation: question.explanationD ?? "" },
    { key: "E", text: normalizeOptionText(question.optionE), explanation: question.explanationE ?? "" },
  ];

  return {
    rawOptions,
    originalCorrect,
    originalCorrectOptions,
  };
}

export function mapDbQuestionToStudyQuestion(question: DbQuestionWithRelations): StudyQuestion {
  const rawQuestionType = (question as DbStudyQuestion & { questionType?: unknown }).questionType;
  const questionType = toQuestionType(rawQuestionType);
  const normalizedFrame = buildRawOptionsFrame(question);
  const originalCorrect = normalizedFrame.originalCorrect;
  const originalCorrectOptions = normalizedFrame.originalCorrectOptions;
  const rawOptions = normalizedFrame.rawOptions;
  const originalOptions = rawOptions.filter((option) => hasRenderableOptionText(option.text));

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
  const nextCorrectSet = new Set<OptionKey>();

  shuffled.forEach((option, index) => {
    const mappedKey = targetKeys[index] ?? "E";
    nextOptions[mappedKey] = option.text;
    nextExplanations[mappedKey] = option.explanation;
    optionMapping.displayToOriginal[mappedKey] = option.key;
    optionMapping.originalToDisplay[option.key] = mappedKey;

    if (option.key === originalCorrect) {
      nextCorrect = mappedKey;
    }

    if (originalCorrectOptions.includes(option.key)) {
      nextCorrectSet.add(mappedKey);
    }
  });

  const nextCorrectOptions = Array.from(nextCorrectSet);
  if (nextCorrectOptions.length === 0) {
    nextCorrectOptions.push(nextCorrect);
  }

  return {
    id: question.id,
    statement: question.statement,
    certificationCode: question.certificationPreset?.code ?? "",
    topic: question.questionAwsServices?.[0]?.service.name ?? question.awsService?.name ?? question.topic,
    difficulty: question.difficulty,
    questionType,
    options: nextOptions,
    correctOption: nextCorrect,
    correctOptions: nextCorrectOptions,
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
