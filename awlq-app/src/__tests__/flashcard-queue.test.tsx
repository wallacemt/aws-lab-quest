// @vitest-environment jsdom
/**
 * Flashcard queue/UI test suite — TC-105 and TC-106
 *
 * Test-Report-001 / DEF-005 fix. These import and exercise the real
 * useFlashcardQueue hook and FlashcardDeck component (no local
 * reimplementations).
 *
 * TC-105: useFlashcardQueue behavior —
 *   - gradeCard never changes currentIndex
 *   - goPrev floors at 0
 *   - goNext on the last card never advances currentIndex past the last index
 *   - a second goNext while a submit is already in flight is a no-op
 *     (DEF-002 regression guard)
 *   - a failed submit keeps pendingGrades intact and isDone false, so the
 *     user's grades survive a retry (DEF-003 regression guard)
 *
 * TC-106: FlashcardDeck remounts (via key={card.id} in FlashcardsScreen) show
 * the new card's front face, never the previous card's flipped back face.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook, render, screen, fireEvent, cleanup } from "@testing-library/react";

// ---------------------------------------------------------------------------
// TC-105: useFlashcardQueue
// ---------------------------------------------------------------------------

const { mockFetchDue, mockSubmitGrades } = vi.hoisted(() => ({
  mockFetchDue: vi.fn(),
  mockSubmitGrades: vi.fn(),
}));

vi.mock("@/features/retention/services/retention-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/retention/services/retention-api")>();
  return {
    ...actual,
    fetchDueFlashcards: mockFetchDue,
    submitFlashcardGrades: mockSubmitGrades,
  };
});

import { useFlashcardQueue } from "@/features/retention/hooks/useFlashcardQueue";
import { FlashcardDeck } from "@/features/retention/components/FlashcardDeck";

const DUE_AT = new Date().toISOString();
const QUEUE_CARDS = [
  {
    id: "c1",
    front: "F1",
    back: "B1",
    hint: null,
    source: "DEFAULT_DECK",
    awsServiceId: null,
    topic: null,
    easeFactor: 2.5,
    intervalDays: 0,
    dueAt: DUE_AT,
  },
  {
    id: "c2",
    front: "F2",
    back: "B2",
    hint: null,
    source: "DEFAULT_DECK",
    awsServiceId: null,
    topic: null,
    easeFactor: 2.5,
    intervalDays: 0,
    dueAt: DUE_AT,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockFetchDue.mockResolvedValue({ cards: QUEUE_CARDS, dueTotal: QUEUE_CARDS.length });
});

afterEach(() => {
  cleanup();
});

async function renderLoadedQueue() {
  const { result } = renderHook(() => useFlashcardQueue());
  await act(async () => {
    await result.current.load();
  });
  return result;
}

describe("TC-105: useFlashcardQueue", () => {
  it("gradeCard records a pending grade but never changes currentIndex", async () => {
    const result = await renderLoadedQueue();

    act(() => {
      result.current.gradeCard("GOOD");
    });

    expect(result.current.currentIndex).toBe(0);
    expect(result.current.pendingGrades).toEqual([{ flashcardId: "c1", grade: "GOOD" }]);
  });

  it("goPrev floors at 0 instead of going negative", async () => {
    const result = await renderLoadedQueue();

    act(() => {
      result.current.goPrev();
    });

    expect(result.current.currentIndex).toBe(0);
  });

  it("goNext on the last card never advances currentIndex past the last index", async () => {
    const result = await renderLoadedQueue();

    await act(async () => {
      await result.current.goNext(); // c1 -> c2 (last card, index 1)
    });
    expect(result.current.currentIndex).toBe(1);

    await act(async () => {
      await result.current.goNext(); // already on the last card, nothing to submit
    });

    expect(result.current.currentIndex).toBe(1);
    expect(result.current.isDone).toBe(true);
  });

  it("a second goNext while a submit is already in flight does not double-submit (DEF-002)", async () => {
    const result = await renderLoadedQueue();

    act(() => {
      result.current.gradeCard("GOOD");
    });
    await act(async () => {
      await result.current.goNext(); // move to the last card
    });
    act(() => {
      result.current.gradeCard("HARD");
    });

    let resolveSubmit!: (value: { updated: number; nextDueCounts: { today: number; tomorrow: number } }) => void;
    mockSubmitGrades.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSubmit = resolve;
        }),
    );

    // First activation starts the submit — mirrors onNext={() => void goNext()}
    // in FlashcardDeck, which fires and doesn't await.
    act(() => {
      void result.current.goNext();
    });
    expect(result.current.isSubmitting).toBe(true);

    // Second activation happens while the first submit is still pending.
    act(() => {
      void result.current.goNext();
    });

    resolveSubmit({ updated: 2, nextDueCounts: { today: 0, tomorrow: 0 } });
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockSubmitGrades).toHaveBeenCalledTimes(1);
  });

  it("a failed submit keeps pendingGrades intact and leaves isDone false (DEF-003)", async () => {
    const result = await renderLoadedQueue();

    act(() => {
      result.current.gradeCard("GOOD");
    });
    await act(async () => {
      await result.current.goNext(); // move to the last card
    });
    act(() => {
      result.current.gradeCard("HARD");
    });

    mockSubmitGrades.mockRejectedValue(new Error("network down"));

    await act(async () => {
      await result.current.goNext(); // last card, submit fails
    });

    expect(result.current.isDone).toBe(false);
    expect(result.current.error).toBeTruthy();
    expect(result.current.pendingGrades).toEqual([
      { flashcardId: "c1", grade: "GOOD" },
      { flashcardId: "c2", grade: "HARD" },
    ]);
  });
});

// ---------------------------------------------------------------------------
// TC-106: FlashcardDeck remount resets to the front face
// ---------------------------------------------------------------------------

const DECK_CARD_1 = {
  id: "card-1",
  front: "Front question 1",
  back: "Back answer 1",
  hint: null,
  source: "DEFAULT_DECK",
  awsServiceId: null,
  topic: null,
  easeFactor: 2.5,
  intervalDays: 0,
  dueAt: DUE_AT,
};

const DECK_CARD_2 = {
  id: "card-2",
  front: "Front question 2",
  back: "Back answer 2",
  hint: null,
  source: "DEFAULT_DECK",
  awsServiceId: null,
  topic: null,
  easeFactor: 2.5,
  intervalDays: 0,
  dueAt: DUE_AT,
};

const DECK_PROPS = {
  cardNumber: 1,
  totalCards: 2,
  isSubmitting: false,
  onGrade: vi.fn(),
  onPrev: vi.fn(),
  onNext: vi.fn(),
  canGoPrev: false,
};

describe("TC-106: FlashcardDeck remount resets to the front face", () => {
  // Both faces are always in the DOM (framer-motion's 3D flip just rotates
  // the wrapping div), so the reliable signal for "is this card flipped" is
  // the grade bar, which only renders `{isFlipped && ...}` — see
  // FlashcardDeck.tsx.
  it("hides the grade bar (i.e. resets isFlipped) after a key-based remount to a new card", () => {
    const { rerender } = render(<FlashcardDeck key={DECK_CARD_1.id} card={DECK_CARD_1} {...DECK_PROPS} />);

    expect(screen.queryByText("Como foi?")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /revelar a resposta/i }));
    expect(screen.getByText("Como foi?")).toBeTruthy();

    // FlashcardsScreen keys FlashcardDeck by card.id, so navigating to a new
    // card is a remount, not a prop update — isFlipped must reset to false,
    // hiding the grade bar again instead of leaking the previous card's
    // flipped state.
    rerender(<FlashcardDeck key={DECK_CARD_2.id} card={DECK_CARD_2} {...DECK_PROPS} />);

    expect(screen.queryByText("Como foi?")).toBeNull();
  });
});
