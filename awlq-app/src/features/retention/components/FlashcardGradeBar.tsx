"use client";

import { Frown, Meh, Smile, Laugh } from "lucide-react";
import { PixelButton } from "@/components/ui/pixel-button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FlashcardGrade } from "@/features/retention/services/retention-api";

type Props = {
  onGrade: (grade: FlashcardGrade) => void;
  selectedGrade?: FlashcardGrade;
  disabled?: boolean;
};

const GRADE_OPTIONS: {
  grade: FlashcardGrade;
  label: string;
  icon: typeof Frown;
  variant: "primary" | "secondary" | "ghost";
}[] = [
  { grade: "VERY_HARD", label: "Muito Difícil", icon: Frown, variant: "ghost" },
  { grade: "HARD", label: "Difícil", icon: Meh, variant: "ghost" },
  { grade: "GOOD", label: "Bom", icon: Smile, variant: "secondary" },
  { grade: "EASY", label: "Fácil", icon: Laugh, variant: "primary" },
];

/**
 * Renders the 4-icon grading row below a flashcard.
 * Labels only show as tooltips on hover; icons escalate from frown to laugh
 * to read as a difficulty gradient without needing text.
 */
export function FlashcardGradeBar({ onGrade, selectedGrade, disabled = false }: Props) {
  return (
    <TooltipProvider>
      <div className="flex justify-center gap-5">
        {GRADE_OPTIONS.map(({ grade, label, icon: Icon, variant }) => (
          <Tooltip key={grade}>
            <TooltipTrigger asChild>
              <PixelButton
                variant={variant}
                disabled={disabled}
                onClick={() => onGrade(grade)}
                aria-label={label}
                className={`!p-3 ${selectedGrade === grade ? "ring-2 ring-[var(--pixel-accent)] ring-offset-2 ring-offset-[var(--pixel-bg)]" : ""}`}
              >
                <Icon className="h-5 w-5" />
              </PixelButton>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
