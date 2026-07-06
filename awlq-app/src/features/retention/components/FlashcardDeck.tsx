"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PixelCard } from "@/components/ui/pixel-card";
import { PixelButton } from "@/components/ui/pixel-button";
import { FlashcardGradeBar } from "@/features/retention/components/FlashcardGradeBar";
import { Flashcard, FlashcardGrade } from "@/features/retention/services/retention-api";

type Props = {
  card: Flashcard;
  cardNumber: number;
  totalCards: number;
  isSubmitting: boolean;
  selectedGrade?: FlashcardGrade;
  onGrade: (grade: FlashcardGrade) => void;
  onPrev: () => void;
  onNext: () => void;
  canGoPrev: boolean;
};

const FACE_STYLE = { backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" } as const;

/**
 * Displays a single flashcard with a 3D flip interaction.
 * Click/tap the card to flip between question and answer, either direction.
 * Grade buttons appear once flipped; prev/next navigation is always available
 * and never gated on grading (grading and advancing are independent actions).
 */
export function FlashcardDeck({
  card,
  cardNumber,
  totalCards,
  isSubmitting,
  selectedGrade,
  onGrade,
  onPrev,
  onNext,
  canGoPrev,
}: Props) {
  const [isFlipped, setIsFlipped] = useState(false);

  function handleFlip() {
    setIsFlipped((prev) => !prev);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative min-h-[220px]" style={{ perspective: 1200 }}>
        <motion.div
          className="relative h-full min-h-[220px] w-full"
          style={{ transformStyle: "preserve-3d" }}
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ duration: 0.45, ease: "easeInOut" }}
        >
          {/* Front face — question */}
          <PixelCard
            className="absolute inset-0 flex cursor-pointer flex-col gap-3 select-none"
            style={FACE_STYLE}
            onClick={handleFlip}
            role="button"
            aria-label="Toque para revelar a resposta"
          >
            {card.hint && (
              <p className="font-mono text-xs uppercase tracking-wide text-[var(--pixel-subtext)]">{card.hint}</p>
            )}
            <p className="font-mono text-sm leading-relaxed text-[var(--pixel-text)]">{card.front}</p>
            <p className="mt-auto text-center font-mono text-xs text-[var(--pixel-subtext)] opacity-80">
              Toque para revelar a resposta
            </p>
          </PixelCard>

          {/* Back face — answer, pre-rotated so it reads right-side-up once flipped */}
          <PixelCard
            className="absolute inset-0 flex cursor-pointer flex-col gap-3 select-none border-[var(--pixel-accent)]"
            style={{ ...FACE_STYLE, transform: "rotateY(180deg)" }}
            onClick={handleFlip}
            role="button"
            aria-label="Toque para voltar à pergunta"
          >
            <p className="font-mono text-xs uppercase tracking-wide text-[var(--pixel-accent)]">Resposta</p>
            <p className="whitespace-pre-line font-mono text-sm leading-relaxed text-[var(--pixel-text)]">
              {card.back}
            </p>
          </PixelCard>
        </motion.div>
      </div>

      {isFlipped && (
        <div className="flex flex-col gap-3">
          <p className="text-center font-mono text-xs text-[var(--pixel-subtext)]">Como foi?</p>
          <FlashcardGradeBar onGrade={onGrade} selectedGrade={selectedGrade} disabled={isSubmitting} />
        </div>
      )}

      <div className="flex items-center justify-center gap-6 pt-2">
        <PixelButton variant="ghost" onClick={onPrev} disabled={!canGoPrev} aria-label="Card anterior">
          <ChevronLeft className="h-4 w-4" />
        </PixelButton>
        <span className="font-mono text-xs text-[var(--pixel-subtext)]">
          Card {cardNumber} / {totalCards}
        </span>
        <PixelButton variant="ghost" onClick={onNext} disabled={isSubmitting} aria-label="Próximo card">
          <ChevronRight className="h-4 w-4" />
        </PixelButton>
      </div>
    </div>
  );
}
