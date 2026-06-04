"use client";

import { useState } from "react";
import { PixelCard } from "@/components/ui/pixel-card";
import { PixelButton } from "@/components/ui/pixel-button";
import { FlashcardGradeBar } from "@/features/retention/components/FlashcardGradeBar";
import { Flashcard, FlashcardGrade } from "@/features/retention/services/retention-api";

type Props = {
  card: Flashcard;
  cardNumber: number;
  totalCards: number;
  isSubmitting: boolean;
  onGrade: (grade: FlashcardGrade) => void;
};

/**
 * Displays a single flashcard with flip interaction.
 * Click/tap anywhere on the card to reveal the back.
 * Grade buttons appear only after flipping.
 */
export function FlashcardDeck({ card, cardNumber, totalCards, isSubmitting, onGrade }: Props) {
  const [isFlipped, setIsFlipped] = useState(false);

  function handleFlip() {
    if (!isFlipped) setIsFlipped(true);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Progress indicator */}
      <p className="text-center font-mono text-xs text-[var(--pixel-muted)]">
        Card {cardNumber} / {totalCards}
      </p>

      {/* Flashcard face */}
      <PixelCard
        className="min-h-[200px] cursor-pointer select-none"
        onClick={handleFlip}
        role="button"
        aria-label={isFlipped ? "Verso do flashcard" : "Toque para revelar a resposta"}
      >
        {!isFlipped ? (
          <div className="flex flex-col gap-3">
            {card.hint && (
              <p className="font-mono text-xs uppercase tracking-wide text-[var(--pixel-muted)]">
                {card.hint}
              </p>
            )}
            <p className="font-mono text-sm leading-relaxed text-[var(--pixel-text)]">{card.front}</p>
            <p className="mt-4 text-center font-mono text-xs text-[var(--pixel-muted)] opacity-70">
              Toque para revelar a resposta
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="font-mono text-xs uppercase tracking-wide text-[var(--pixel-accent)]">Resposta</p>
            <p className="whitespace-pre-line font-mono text-sm leading-relaxed text-[var(--pixel-text)]">
              {card.back}
            </p>
          </div>
        )}
      </PixelCard>

      {/* Grade bar appears only after flip */}
      {isFlipped ? (
        <div className="flex flex-col gap-2">
          <p className="text-center font-mono text-xs text-[var(--pixel-muted)]">Como foi?</p>
          <FlashcardGradeBar onGrade={onGrade} disabled={isSubmitting} />
        </div>
      ) : (
        <PixelButton variant="ghost" onClick={handleFlip} className="w-full">
          Revelar resposta
        </PixelButton>
      )}
    </div>
  );
}
