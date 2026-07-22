"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PixelButton } from "@/components/ui/pixel-button";
import { PixelCard } from "@/components/ui/pixel-card";
import { FlashcardDeck } from "@/features/retention/components/FlashcardDeck";
import { FlashcardManager } from "@/features/retention/components/FlashcardManager";
import { useFlashcardQueue } from "@/features/retention/hooks/useFlashcardQueue";
import { useRouter } from "next/navigation";

/**
 * Main flashcard review screen.
 * Loads due cards on mount, presents them one by one, submits grades in batch
 * once the user navigates past the last card.
 * Also hosts the "Meus Flashcards" management panel (issue #22 AC).
 */
export function FlashcardsScreen() {
  const {
    cards,
    currentIndex,
    dueTotal,
    pendingGrades,
    isLoading,
    isSubmitting,
    isDone,
    error,
    load,
    gradeCard,
    goNext,
    goPrev,
    retrySubmit,
  } = useFlashcardQueue();
  const [mode, setMode] = useState<"review" | "manage">("review");
  const router = useRouter();
  useEffect(() => {
    void load();
  }, [load]);

  if (mode === "manage") {
    return (
      <AppLayout>
        <FlashcardManager onClose={() => setMode("review")} />
      </AppLayout>
    );
  }

  if (isLoading) {
    return (
      <AppLayout>
        <PixelCard className="mx-auto mt-16 max-w-lg text-center">
          <p className="font-mono text-sm text-[var(--pixel-subtext)]">Carregando flashcards...</p>
        </PixelCard>
      </AppLayout>
    );
  }

  if (error) {
    // A failed grade submission (still on the last card, grades retained)
    // needs a different recovery action than a failed load: retrying the
    // submit reuses the retained pendingGrades, while load() would discard
    // them and re-fetch a fresh queue (DEF-003).
    const hasPendingSubmit = pendingGrades.length > 0;
    return (
      <AppLayout>
        <PixelCard className="mx-auto mt-16 flex max-w-lg flex-col items-center gap-4 text-center">
          <p className="font-mono text-sm text-red-500">{error}</p>
          {hasPendingSubmit ? (
            <PixelButton onClick={() => void retrySubmit()} disabled={isSubmitting}>
              Tentar enviar novamente
            </PixelButton>
          ) : (
            <PixelButton variant="ghost" onClick={() => void load()}>
              Tentar novamente
            </PixelButton>
          )}
        </PixelCard>
      </AppLayout>
    );
  }

  const currentCard = cards[currentIndex];
  const selectedGrade = currentCard
    ? pendingGrades.find((item) => item.flashcardId === currentCard.id)?.grade
    : undefined;

  return (
    <AppLayout>
      <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-6">
        <PixelButton variant="ghost" onClick={() => router.back()}>
          ← Voltar
        </PixelButton>
        <PixelCard className="flex items-center justify-between gap-3">
          <h1 className="font-mono text-sm uppercase tracking-wide text-[var(--pixel-text)]">Flashcards</h1>
          <div className="flex flex-col-reverse items-center gap-3">
            <p className="font-mono text-xs text-[var(--pixel-subtext)]">{dueTotal} para hoje</p>
            <PixelButton variant="ghost" onClick={() => setMode("manage")}>
              Meus flashcards
            </PixelButton>
          </div>
        </PixelCard>
        {isDone && (
          <PixelCard className="mx-auto mt-16 flex max-w-lg flex-col items-center gap-4 text-center">
            <p className="font-mono text-lg text-[var(--pixel-accent)]">Sessão concluída!</p>
            <p className="font-mono text-sm text-[var(--pixel-text)]">
              Ótimo trabalho! Você manteve seu ritmo de revisão em dia. Continue praticando diariamente para fortalecer
              a memória de longo prazo.
            </p>
            {dueTotal > cards.length && (
              <p className="font-mono text-sm text-[var(--pixel-subtext)]">
                Existem mais {dueTotal - cards.length} cards — volte mais tarde.
              </p>
            )}
            <PixelButton onClick={() => void load()}>Revisar novamente</PixelButton>
          </PixelCard>
        )}
        {!isDone && currentCard && (
          <FlashcardDeck
            key={currentCard.id}
            card={currentCard}
            cardNumber={currentIndex + 1}
            totalCards={cards.length}
            isSubmitting={isSubmitting}
            selectedGrade={selectedGrade}
            onGrade={gradeCard}
            onPrev={goPrev}
            onNext={() => void goNext()}
            canGoPrev={currentIndex > 0}
          />
        )}

        {cards.length === 0 && !isDone && (
          <PixelCard className="mx-auto mt-16 flex max-w-lg flex-col items-center gap-4 text-center">
            <p className="font-mono text-sm text-[var(--pixel-subtext)]">
              Nenhum flashcard pendente para hoje. Continue estudando e os cards aparecerão aqui conforme você responder
              questões no KC ou Revisão.
            </p>
            <div className="flex gap-2">
              <PixelButton variant="ghost" onClick={() => void load()}>
                Verificar novamente
              </PixelButton>
              <PixelButton onClick={() => setMode("manage")}>Criar flashcard</PixelButton>
            </div>
          </PixelCard>
        )}
      </div>
    </AppLayout>
  );
}
