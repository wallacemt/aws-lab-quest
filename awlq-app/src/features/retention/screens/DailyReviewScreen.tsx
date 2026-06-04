"use client";

import { useRouter } from "next/navigation";
import { DailyReviewBoard } from "@/features/retention/components/DailyReviewBoard";

/**
 * Wraps DailyReviewBoard and wires navigation actions.
 */
export function DailyReviewScreen() {
  const router = useRouter();

  function handleStartFlashcards() {
    router.push("/flashcards");
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <h1 className="mb-6 font-mono text-sm uppercase tracking-wide text-[var(--pixel-text)]">
        Revisão Diária
      </h1>
      <DailyReviewBoard onStartFlashcards={handleStartFlashcards} />
    </div>
  );
}
