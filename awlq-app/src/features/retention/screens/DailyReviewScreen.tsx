"use client";

import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
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
    <AppLayout>
      <div className="mx-auto max-w-5xl px-4 py-8">
        <DailyReviewBoard onStartFlashcards={handleStartFlashcards} />
      </div>
    </AppLayout>
  );
}
