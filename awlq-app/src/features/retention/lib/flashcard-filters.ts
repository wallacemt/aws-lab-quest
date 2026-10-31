import { Flashcard } from "@/features/retention/services/retention-api";
import { getFlashcardSourceLabel } from "@/features/retention/lib/flashcard-source-labels";

export type FlashcardWithPriority = Flashcard & { isOverdue: boolean };
export type FlashcardCriteria = {
  query: string;
  origin: "all" | "user" | "auto";
  queue: "all" | "queued" | "suspended";
  due: "all" | "overdue" | "upcoming";
  awsServiceId: string | null;
  sort: "createdDesc" | "dueAsc" | "easeAsc";
};

export function filterFlashcards(
  cards: FlashcardWithPriority[],
  criteria: FlashcardCriteria,
  serviceNames: Map<string, string>,
): FlashcardWithPriority[] {
  const query = criteria.query.trim().toLocaleLowerCase();
  return cards.filter((card) => {
    const source = getFlashcardSourceLabel(card.source);
    const matchesQuery = !query || [card.front, card.back, card.hint ?? "", card.topic ?? "", serviceNames.get(card.awsServiceId ?? "") ?? ""]
      .some((value) => value.toLocaleLowerCase().includes(query));
    return matchesQuery &&
      (criteria.origin === "all" || source.group === criteria.origin) &&
      (criteria.queue === "all" || (criteria.queue === "queued" ? !card.suspended : card.suspended)) &&
      (criteria.due === "all" || (criteria.due === "overdue" ? card.isOverdue : !card.isOverdue)) &&
      (!criteria.awsServiceId || card.awsServiceId === criteria.awsServiceId);
  });
}

export function sortFlashcards(cards: FlashcardWithPriority[], sort: FlashcardCriteria["sort"]): FlashcardWithPriority[] {
  return [...cards].sort((a, b) => {
    if (sort === "dueAsc") return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
    if (sort === "easeAsc") return a.easeFactor - b.easeFactor;
    return 0;
  });
}

export function countFlashcards(cards: FlashcardWithPriority[], filteredCount: number): string {
  return filteredCount === cards.length ? `${cards.length} CARDS` : `${filteredCount} DE ${cards.length} CARDS`;
}
