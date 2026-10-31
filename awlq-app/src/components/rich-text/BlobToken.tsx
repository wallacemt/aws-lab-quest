"use client";
import { useState } from "react";
export function BlobToken({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false); const [copied, setCopied] = useState(false);
  const preview = `${text.slice(0, 12)}…${text.slice(-6)} · ${text.length} caracteres`;
  return <span className="my-1 inline-flex min-w-0 flex-col [overflow-wrap:anywhere]"><span className="font-mono">{preview}</span><span className="flex gap-2"><button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? "Ocultar" : "Expandir"}</button><button type="button" onClick={() => void navigator.clipboard.writeText(text).then(() => setCopied(true))}>{copied ? "Copiado" : "Copiar"}</button></span>{expanded && <pre className="max-h-64 overflow-y-auto break-all whitespace-pre-wrap font-mono">{text}</pre>}</span>;
}
