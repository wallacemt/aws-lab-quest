export type FlashcardSourceLabel = {
  shortLabel: string;
  longLabel: string;
  group: "user" | "auto";
};

export const FLASHCARD_SOURCE_LABELS: Record<string, FlashcardSourceLabel> = {
  USER_CREATED: { shortLabel: "MEU", longLabel: "Criado por você", group: "user" },
  WRONG_ANSWER: { shortLabel: "ERRO", longLabel: "Erro em questão", group: "auto" },
  REVIEW_FLAG: { shortLabel: "MARCADA", longLabel: "Questão marcada para revisão", group: "auto" },
  SLOW_ANSWER: { shortLabel: "LENTA", longLabel: "Resposta lenta", group: "auto" },
  AI_EXPLANATION: { shortLabel: "IA", longLabel: "Explicação da IA", group: "auto" },
  MEMORY_RECOVERY: { shortLabel: "MEMÓRIA", longLabel: "Recuperação de memória", group: "auto" },
  DEFAULT_DECK: { shortLabel: "INICIAL", longLabel: "Deck inicial", group: "auto" },
};

export const UNKNOWN_FLASHCARD_SOURCE: FlashcardSourceLabel = {
  shortLabel: "AUTO",
  longLabel: "Automático",
  group: "auto",
};

export function getFlashcardSourceLabel(source: string): FlashcardSourceLabel {
  return FLASHCARD_SOURCE_LABELS[source] ?? UNKNOWN_FLASHCARD_SOURCE;
}
