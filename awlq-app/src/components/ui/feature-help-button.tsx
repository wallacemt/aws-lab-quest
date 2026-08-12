"use client";

import { useEffect, useState, type ReactNode } from "react";
import { HelpCircle, X } from "lucide-react";
import { PixelButton } from "@/components/ui/pixel-button";
import { PixelCard } from "@/components/ui/pixel-card";

type FeatureHelpButtonProps = {
  title: string;
  description: ReactNode;
  className?: string;
};

export function FeatureHelpButton({ title, description, className = "" }: FeatureHelpButtonProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Ajuda: ${title}`}
        title={`Ajuda: ${title}`}
        className={`inline-flex h-6 w-6 shrink-0 items-center justify-center border-2 border-[var(--pixel-border)] bg-[var(--pixel-card)] text-[var(--pixel-subtext)] shadow-[2px_2px_0_0_var(--pixel-shadow)] transition-colors hover:text-[var(--pixel-primary)] active:translate-y-[1px] ${className}`}
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4"
          onClick={() => setOpen(false)}
        >
          <PixelCard
            className="w-full max-w-md space-y-3 shadow-[6px_6px_0_0_var(--pixel-shadow)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="font-mono text-xs uppercase text-[var(--pixel-primary)]">{title}</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fechar"
                className="text-[var(--pixel-subtext)] hover:text-[var(--pixel-text)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="font-[var(--font-body)] text-sm leading-6 text-[var(--pixel-text)]">{description}</div>
            <div className="flex justify-end">
              <PixelButton variant="ghost" onClick={() => setOpen(false)}>
                Entendi
              </PixelButton>
            </div>
          </PixelCard>
        </div>
      )}
    </>
  );
}
