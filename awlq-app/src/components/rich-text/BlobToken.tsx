"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function BlobToken({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const preview = `${text.slice(0, 12)}…${text.slice(-6)}`;

  return (
    <span className="relative my-1 inline-flex min-w-0 [overflow-wrap:anywhere]">
      <span
        title={`${text.length} caracteres`}
        className="mr-7 inline-flex w-fit items-center rounded-sm bg-[var(--pixel-muted)]/60 px-2 py-0.5 font-mono text-xs text-[var(--pixel-text)]"
      >
        {preview}
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={copied ? "Token copiado" : "Copiar token"}
            onClick={() => void navigator.clipboard.writeText(text).then(() => setCopied(true))}
            className="absolute right-1 top-0 flex h-6 w-6 items-center justify-center rounded-sm text-[var(--pixel-subtext)] transition-colors hover:bg-[var(--pixel-muted)] hover:text-[var(--pixel-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pixel-text)]"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </TooltipTrigger>
        <TooltipContent>{copied ? "Copiado" : "Copiar"}</TooltipContent>
      </Tooltip>
    </span>
  );
}
