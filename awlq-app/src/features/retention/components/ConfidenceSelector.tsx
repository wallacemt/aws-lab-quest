"use client";

import { PixelButton } from "@/components/ui/pixel-button";

export type AnswerConfidence = "high" | "medium" | "low";

type Props = {
  onSelect: (confidence: AnswerConfidence) => void;
  disabled?: boolean;
};

const CONFIDENCE_OPTIONS: {
  value: AnswerConfidence;
  label: string;
  variant: "primary" | "secondary" | "ghost";
}[] = [
  { value: "high",   label: "Muito confiante🤩",  variant: "primary" },
  { value: "medium", label: "Mais ou menos🥹",    variant: "secondary" },
  { value: "low",    label: "Chutei💀",           variant: "ghost" },
];

/**
 * Displayed after a question answer, before advancing to the next question.
 * Captures confidence level for false-belief signal aggregation (RF-09, ADR-05).
 */
export function ConfidenceSelector({ onSelect, disabled = false }: Props) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-center font-mono text-xs text-accent">
        Quão confiante você estava?
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {CONFIDENCE_OPTIONS.map(({ value, label, variant }) => (
          <PixelButton
            key={value}
            variant={variant}
            disabled={disabled}
            onClick={() => onSelect(value)}
            className="min-w-[130px]"
          >
            {label}
          </PixelButton>
        ))}
      </div>
    </div>
  );
}
