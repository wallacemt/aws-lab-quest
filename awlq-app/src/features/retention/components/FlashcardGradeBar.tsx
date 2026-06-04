"use client";

import { PixelButton } from "@/components/ui/pixel-button";
import { FlashcardGrade } from "@/features/retention/services/retention-api";

type Props = {
  onGrade: (grade: FlashcardGrade) => void;
  disabled?: boolean;
};

const GRADE_OPTIONS: { grade: FlashcardGrade; label: string; variant: "primary" | "secondary" | "ghost" }[] = [
  { grade: "VERY_HARD", label: "Muito Difícil", variant: "ghost" },
  { grade: "HARD",      label: "Difícil",       variant: "ghost" },
  { grade: "GOOD",      label: "Bom",            variant: "secondary" },
  { grade: "EASY",      label: "Fácil",          variant: "primary" },
];

/**
 * Renders the 4-button grading bar below a flashcard.
 * Buttons are disabled while the grade is being submitted.
 */
export function FlashcardGradeBar({ onGrade, disabled = false }: Props) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {GRADE_OPTIONS.map(({ grade, label, variant }) => (
        <PixelButton
          key={grade}
          variant={variant}
          disabled={disabled}
          onClick={() => onGrade(grade)}
          className="min-w-[110px]"
        >
          {label}
        </PixelButton>
      ))}
    </div>
  );
}
