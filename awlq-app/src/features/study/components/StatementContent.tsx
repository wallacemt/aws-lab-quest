"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { formatStatement } from "@/lib/statement-formatting";

export function StatementContent({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copyCode(code: string) {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <>
      {formatStatement(text).map((segment, index) =>
        segment.type === "code" ? (
          <div key={index} className="relative my-3 max-w-full border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)]">
            <button
              type="button"
              onClick={() => void copyCode(segment.text)}
              aria-label={copied ? "Copiado" : "Copiar código"}
              className="absolute right-1 top-1 inline-flex items-center gap-1 border border-[var(--pixel-border)] bg-[var(--pixel-card)] px-2 py-1 font-mono text-[9px] text-[var(--pixel-subtext)] hover:text-[var(--pixel-text)]"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "Copiado" : "Copiar"}
            </button>
            <pre className="max-w-full overflow-x-auto p-3 pr-20 font-mono text-sm">
              <code>{segment.text}</code>
            </pre>
          </div>
        ) : (
          <span key={index} className="break-words font-[var(--font-body)]">
            {segment.text}
          </span>
        ),
      )}
    </>
  );
}
