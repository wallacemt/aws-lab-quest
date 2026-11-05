"use client";

import * as React from "react";
import { Dialog } from "radix-ui";
import { X } from "lucide-react";

export function PixelDialog({
  open,
  onOpenChange,
  title,
  children,
  dismissible = true,
  tone = "default",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
  dismissible?: boolean;
  tone?: "default" | "warn";
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/75" />
        <Dialog.Content
          onEscapeKeyDown={(event) => { if (!dismissible) event.preventDefault(); }}
          onPointerDownOutside={(event) => { if (!dismissible) event.preventDefault(); }}
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 flex-col border-2 border-[var(--pixel-border)] bg-[var(--pixel-card)] shadow-[6px_6px_0_0_var(--pixel-shadow)] max-md:inset-0 max-md:h-dvh max-md:w-dvw max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0"
        >
          <header className={`flex items-center justify-between border-b-2 p-4 ${tone === "warn" ? "border-[var(--admin-status-warn)] bg-[var(--admin-status-warn)]/10" : "border-[var(--pixel-muted)]"}`}>
            <Dialog.Title className="font-mono text-xs uppercase tracking-wide text-[var(--pixel-text)]">{title}</Dialog.Title>
            {dismissible && <Dialog.Close aria-label="Fechar" className="flex size-11 items-center justify-center text-[var(--pixel-text)] focus-visible:outline-2"><X /></Dialog.Close>}
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
