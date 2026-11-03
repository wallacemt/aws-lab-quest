import { describe, expect, it } from "vitest";
import { countFlashcards, filterFlashcards, sortFlashcards, FlashcardCriteria, FlashcardWithPriority } from "@/features/retention/lib/flashcard-filters";
import { FLASHCARD_SOURCE_LABELS, getFlashcardSourceLabel } from "@/features/retention/lib/flashcard-source-labels";

const card = (id: string, overrides: Partial<FlashcardWithPriority> = {}): FlashcardWithPriority => ({
  id, front: `Question ${id}`, back: "Answer", hint: "Hint", source: "USER_CREATED", awsServiceId: null,
  topic: "Storage", easeFactor: 2.5, intervalDays: 1, dueAt: "2026-01-01", suspended: false,
  isOverdue: false, ...overrides,
});

const criteria: FlashcardCriteria = { query: "", origin: "all", queue: "all", due: "all", awsServiceId: null, sort: "createdDesc" };

describe("flashcard filters", () => {
  it("combines search, origin, queue, due and service filters", () => {
    const cards = [
      card("user", { front: "VPC endpoint", awsServiceId: "s3", isOverdue: true }),
      card("automatic", { source: "WRONG_ANSWER", front: "VPC endpoint" }),
      card("suspended", { suspended: true, front: "VPC endpoint" }),
    ];
    expect(filterFlashcards(cards, { ...criteria, query: "ENDPOINT", origin: "auto", queue: "queued", due: "upcoming", awsServiceId: "s3" }, new Map([["s3", "Amazon S3"]]))).toEqual([]);
    expect(filterFlashcards(cards, { ...criteria, query: "VPC", origin: "auto" }, new Map()).map(({ id }) => id)).toEqual(["automatic"]);
  });

  it("searches service names and sorts without mutating input", () => {
    const cards = [card("later", { dueAt: "2026-02-01", easeFactor: 3 }), card("soon", { dueAt: "2026-01-01", easeFactor: 1 })];
    expect(filterFlashcards(cards, { ...criteria, query: "amazon" }, new Map([["s3", "Amazon S3"]]))).toEqual([]);
    const withService = [card("service", { awsServiceId: "s3" })];
    expect(filterFlashcards(withService, { ...criteria, query: "amazon" }, new Map([["s3", "Amazon S3"]]))).toHaveLength(1);
    expect(sortFlashcards(cards, "dueAsc").map(({ id }) => id)).toEqual(["soon", "later"]);
    expect(cards[0].id).toBe("later");
    expect(countFlashcards(cards, 1)).toBe("1 DE 2 CARDS");
  });
});

describe("flashcard source labels", () => {
  it("has labels for all known origins and a safe unknown fallback", () => {
    expect(Object.keys(FLASHCARD_SOURCE_LABELS)).toHaveLength(7);
    expect(FLASHCARD_SOURCE_LABELS.WRONG_ANSWER).toEqual({ shortLabel: "ERRO", longLabel: "Erro em questão", group: "auto" });
    expect(getFlashcardSourceLabel("FUTURE_SOURCE")).toEqual({ shortLabel: "AUTO", longLabel: "Automático", group: "auto" });
  });
});
