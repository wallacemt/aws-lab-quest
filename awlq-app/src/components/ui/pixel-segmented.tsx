"use client";

import { useId } from "react";

export type PixelSegmentedOption<T extends string> = { value: T; label: string; icon?: React.ReactNode };

export function PixelSegmented<T extends string>({
  legend,
  value,
  options,
  onChange,
  className = "",
}: {
  legend: string;
  value: T;
  options: PixelSegmentedOption<T>[];
  onChange: (value: T) => void;
  className?: string;
}) {
  const id = useId();
  return (
    <fieldset className={className}>
      <legend className="mb-2 font-mono text-[10px] uppercase tracking-wide text-[var(--pixel-subtext)]">{legend}</legend>
      <div className="flex flex-wrap gap-1">
        {options.map((option) => {
          const inputId = `${id}-${option.value}`;
          return (
            <label key={option.value} htmlFor={inputId} className="cursor-pointer">
              <input id={inputId} className="peer sr-only" type="radio" name={id} checked={value === option.value} onChange={() => onChange(option.value)} />
              <span className="inline-flex min-h-11 items-center justify-center gap-1 border-2 border-[var(--admin-control-border)] px-2 font-mono text-[10px] uppercase tracking-wide text-[var(--pixel-text)] peer-checked:border-[var(--pixel-primary)] peer-checked:bg-[var(--pixel-primary)] peer-checked:text-[var(--admin-inset)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--pixel-text)]">
                {option.icon}{option.label}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
