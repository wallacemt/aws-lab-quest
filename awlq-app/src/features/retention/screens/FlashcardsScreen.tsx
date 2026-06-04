"use client";

import { useEffect } from "react";
import { PixelButton } from "@/components/ui/pixel-button";
import { FlashcardDeck } from "@/features/retention/components/FlashcardDeck";
import { useFlashcardQueue } from "@/features/retention/hooks/useFlashcardQueue";

/**
 * Main flashcard review screen.
 * Loads due cards on mount, presents them one by one, submits grades in batch.
 */
export function FlashcardsScreen() {
  const { cards, currentIndex, dueTotal, isLoading, isSubmitting, isDone, error, load, gradeCard } =
    useFlashcardQueue();

  useEffect(() => {
    void load();
  }, [load]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <p className="font-mono text-sm text-[var(--pixel-muted)]">Carregando flashcards...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <p className="font-mono text-sm text-red-500">{error}</p>
        <PixelButton variant="ghost" onClick={() => void load()}>
          Tentar novamente
        </PixelButton>
      </div>
    );
  }

  if (isDone) {
    return (
      <div className="flex flex-col items-center gap-6 py-16">
        <p className="font-mono text-lg text-[var(--pixel-accent)]">Sessão concluída!</p>
        {dueTotal > cards.length && (
          <p className="font-mono text-sm text-[var(--pixel-muted)]">
            Existem mais {dueTotal - cards.length} cards — volte mais tarde.
          </p>
        )}
        <PixelButton onClick={() => void load()}>Revisar novamente</PixelButton>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <p className="font-mono text-sm text-[var(--pixel-muted)]">
          Nenhum flashcard pendente para hoje.
        </p>
        <PixelButton variant="ghost" onClick={() => void load()}>
          Verificar novamente
        </PixelButton>
      </div>
    );
  }

  const currentCard = cards[currentIndex];
  if (!currentCard) return null;

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="font-mono text-sm uppercase tracking-wide text-[var(--pixel-text)]">
          Flashcards
        </h1>
        <p className="font-mono text-xs text-[var(--pixel-muted)]">{dueTotal} para hoje</p>
      </div>

      <FlashcardDeck
        card={currentCard}
        cardNumber={currentIndex + 1}
        totalCards={cards.length}
        isSubmitting={isSubmitting}
        onGrade={gradeCard}
      />
    </div>
  );
}
