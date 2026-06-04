"use client";

import { useEffect, useRef, useState } from "react";
import { PixelCard } from "@/components/ui/pixel-card";
import { PixelButton } from "@/components/ui/pixel-button";
import { SprintQuestion } from "@/features/retention/services/retention-api";

type Props = {
  question: SprintQuestion;
  currentIndex: number;
  totalQuestions: number;
  limitSeconds: number | null;
  onAnswer: (questionId: string, correct: boolean) => void;
  isSubmitting: boolean;
};

const OPTION_KEYS = ["A", "B", "C", "D", "E"] as const;
type OptionKey = (typeof OPTION_KEYS)[number];

/**
 * Renders a single sprint question with optional countdown timer.
 * Timed modes (t3, t5) show a countdown bar at the top.
 */
export function SprintRunner({
  question,
  currentIndex,
  totalQuestions,
  limitSeconds,
  onAnswer,
  isSubmitting,
}: Props) {
  // Key the entire component on question.id so React unmounts/remounts on question change.
  // This avoids setState-in-effect for the reset pattern.
  const [selected, setSelected] = useState<OptionKey | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(limitSeconds ?? 0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Countdown timer for timed modes — only runs once per component mount (keyed by question.id).
  useEffect(() => {
    if (!limitSeconds) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1_000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSelect(option: OptionKey) {
    if (submitted) return;
    setSelected(option);
  }

  function handleSubmit() {
    if (!selected || submitted) return;
    setSubmitted(true);
    const isCorrect = selected === question.correctOption.toUpperCase();
    onAnswer(question.id, isCorrect);
  }

  const options = OPTION_KEYS.map((key) => ({
    key,
    text: question[`option${key}` as `option${OptionKey}`] ?? null,
  })).filter((o) => o.text);

  return (
    <div className="flex flex-col gap-4">
      {/* Progress + timer */}
      <div className="flex items-center justify-between">
        <p className="font-mono text-xs text-[var(--pixel-muted)]">
          Questão {currentIndex + 1} / {totalQuestions}
        </p>
        {limitSeconds && (
          <p className={`font-mono text-xs ${timeLeft < 30 ? "text-red-500" : "text-[var(--pixel-muted)]"}`}>
            {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
          </p>
        )}
      </div>

      {/* Question card */}
      <PixelCard>
        <p className="font-mono text-sm leading-relaxed text-[var(--pixel-text)]">{question.statement}</p>
      </PixelCard>

      {/* Options */}
      <div className="flex flex-col gap-2">
        {options.map(({ key, text }) => (
          <PixelButton
            key={key}
            variant={selected === key ? "primary" : "ghost"}
            onClick={() => handleSelect(key)}
            disabled={submitted || isSubmitting}
            className="w-full justify-start text-left"
          >
            <span className="shrink-0 font-bold">{key}.</span>
            <span className="ml-2">{text}</span>
          </PixelButton>
        ))}
      </div>

      {/* Confirm button */}
      {!submitted && (
        <PixelButton
          onClick={handleSubmit}
          disabled={!selected || isSubmitting}
          className="w-full"
        >
          Confirmar
        </PixelButton>
      )}
    </div>
  );
}
