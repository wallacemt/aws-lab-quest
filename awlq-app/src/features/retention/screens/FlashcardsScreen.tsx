"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PixelButton } from "@/components/ui/pixel-button";
import { FlashcardDeck } from "@/features/retention/components/FlashcardDeck";
import { FlashcardManager } from "@/features/retention/components/FlashcardManager";
import { useFlashcardQueue } from "@/features/retention/hooks/useFlashcardQueue";

/**
 * Main flashcard review screen.
 * Loads due cards on mount, presents them one by one, submits grades in batch.
 * Also hosts the "Meus Flashcards" management panel (issue #22 AC).
 */
export function FlashcardsScreen() {
  const { cards, currentIndex, dueTotal, isLoading, isSubmitting, isDone, error, load, gradeCard } =
    useFlashcardQueue();
  const [mode, setMode] = useState<"review" | "manage">("review");

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
        <div className="flex justify-center py-16">
          <p className="font-mono text-sm text-[var(--pixel-muted)]">Carregando flashcards...</p>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center gap-4 py-16">
          <p className="font-mono text-sm text-red-500">{error}</p>
          <PixelButton variant="ghost" onClick={() => void load()}>
            Tentar novamente
          </PixelButton>
        </div>
      </AppLayout>
    );
  }

  if (isDone) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center gap-6 py-16">
          <p className="font-mono text-lg text-[var(--pixel-accent)]">Sessão concluída!</p>
          <p className="font-mono text-sm text-[var(--pixel-text)] text-center max-w-sm">
            Ótimo trabalho! Você manteve seu ritmo de revisão em dia. Continue praticando diariamente para fortalecer a memória de longo prazo.
          </p>
          {dueTotal > cards.length && (
            <p className="font-mono text-sm text-[var(--pixel-muted)]">
              Existem mais {dueTotal - cards.length} cards — volte mais tarde.
            </p>
          )}
          <PixelButton onClick={() => void load()}>Revisar novamente</PixelButton>
        </div>
      </AppLayout>
    );
  }

  if (cards.length === 0) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center gap-4 py-16 text-center px-4">
          <p className="font-mono text-sm text-[var(--pixel-muted)] max-w-sm">
            Nenhum flashcard pendente para hoje. Continue estudando e os cards aparecerão aqui
            conforme você responder questões no KC ou Revisão.
          </p>
          <div className="flex gap-2">
            <PixelButton variant="ghost" onClick={() => void load()}>
              Verificar novamente
            </PixelButton>
            <PixelButton onClick={() => setMode("manage")}>Criar flashcard</PixelButton>
          </div>
        </div>
      </AppLayout>
    );
  }

  const currentCard = cards[currentIndex];
  if (!currentCard) return null;

  return (
    <AppLayout>
      <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-6">
        <div className="flex items-center justify-between">
          <h1 className="font-mono text-sm uppercase tracking-wide text-[var(--pixel-text)]">
            Flashcards
          </h1>
          <div className="flex items-center gap-3">
            <p className="font-mono text-xs text-[var(--pixel-muted)]">{dueTotal} para hoje</p>
            <PixelButton variant="ghost" onClick={() => setMode("manage")}>
              Meus flashcards
            </PixelButton>
          </div>
        </div>

        <FlashcardDeck
          card={currentCard}
          cardNumber={currentIndex + 1}
          totalCards={cards.length}
          isSubmitting={isSubmitting}
          onGrade={gradeCard}
        />
      </div>
    </AppLayout>
  );
}
