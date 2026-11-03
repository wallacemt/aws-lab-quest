"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { PixelButton } from "@/components/ui/pixel-button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CODE_COLLAPSE_CHARS, CODE_COLLAPSE_LINES } from "@/lib/rich-text-constants";

export function CodeBlock({ text }: { text: string; language: "json" | "text" }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const lines = text.split("\n").length;
  const collapsible = lines > CODE_COLLAPSE_LINES || text.length > CODE_COLLAPSE_CHARS;
  const shown = collapsible && !expanded ? text.slice(0, CODE_COLLAPSE_CHARS) : text;

  return (
    <div className="relative my-3 min-w-0 max-w-full border border-[var(--pixel-border)] border-l-2 border-l-[var(--pixel-accent)] bg-[var(--pixel-muted)]/40 px-3 py-2 pr-11 pt-10 [overflow-wrap:anywhere]">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={copied ? "Copiado" : "Copiar bloco"}
            onClick={() => void navigator.clipboard.writeText(text).then(() => setCopied(true))}
            className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-sm text-[var(--pixel-subtext)] transition-colors hover:bg-[var(--pixel-muted)] hover:text-[var(--pixel-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pixel-text)]"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </TooltipTrigger>
        <TooltipContent>{copied ? "Copiado" : "Copiar"}</TooltipContent>
      </Tooltip>
      <pre className="max-h-96 max-w-full overflow-y-auto whitespace-pre-wrap break-all font-[var(--font-body)] text-sm [overflow-wrap:anywhere]">
        <code>{shown}</code>
      </pre>
      {collapsible && !expanded && (
        <PixelButton
          type="button"
          variant="ghost"
          className="mt-2 px-2 py-1 text-[10px] text-[var(--pixel-subtext)]"
          onClick={() => setExpanded(true)}
        >
          Mostrar tudo · {lines} linhas
        </PixelButton>
      )}
    </div>
  );
}
