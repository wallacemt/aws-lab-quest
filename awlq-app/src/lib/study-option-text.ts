export function normalizeOptionText(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = value.trim();
  if (!normalized) {
    return "";
  }

  if (/^(null|undefined)$/i.test(normalized)) {
    return "";
  }

  return normalized;
}

export function hasRenderableOptionText(value: unknown): boolean {
  return normalizeOptionText(value).length > 0;
}

type ReviewOptionSource = {
  options: Record<string, string>;
  explanations: Record<string, string>;
  selectedOption: string;
  selectedOptions?: string[];
  correctOption: string;
  correctOptions?: string[];
};

export type ReviewOption = {
  option: string;
  text: string;
  explanation: string;
  isCorrect: boolean;
  isSelected: boolean;
};

/** Shapes a raw answer snapshot into the per-option list QuestionReviewPanel expects. */
export function buildReviewOptions(snapshot: ReviewOptionSource): ReviewOption[] {
  const selectedLabels = Array.isArray(snapshot.selectedOptions) ? snapshot.selectedOptions : [snapshot.selectedOption];
  const correctLabels = Array.isArray(snapshot.correctOptions) ? snapshot.correctOptions : [snapshot.correctOption];

  return Object.entries(snapshot.options)
    .map(([option, optionText]) => ({ option, text: normalizeOptionText(optionText) }))
    .filter((item) => item.text.length > 0)
    .map(({ option, text }) => ({
      option,
      text,
      explanation: snapshot.explanations[option] ?? "Sem explicacao adicional.",
      isCorrect: correctLabels.includes(option),
      isSelected: selectedLabels.includes(option),
    }));
}
