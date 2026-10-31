"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { CODE_COLLAPSE_CHARS, CODE_COLLAPSE_LINES } from "@/lib/rich-text-constants";

export function CodeBlock({ text, language }: { text: string; language: "json" | "text" }) {
  const [expanded, setExpanded] = useState(false); const [copied, setCopied] = useState(false);
  const lines = text.split("\n").length; const collapsible = lines > CODE_COLLAPSE_LINES || text.length > CODE_COLLAPSE_CHARS;
  const shown = collapsible && !expanded ? text.slice(0, CODE_COLLAPSE_CHARS) : text;
  return <div className="my-3 min-w-0 max-w-full border p-3 [overflow-wrap:anywhere]"><div className="mb-2 flex gap-2 text-xs"><span>{language}</span><button type="button" onClick={() => void navigator.clipboard.writeText(text).then(() => setCopied(true))}>{copied ? <Check size={14}/> : <Copy size={14}/>} Copiar</button></div><pre className="max-h-96 max-w-full overflow-y-auto whitespace-pre-wrap break-all font-mono text-sm"><code>{shown}</code></pre>{collapsible && !expanded && <button type="button" onClick={() => setExpanded(true)}>Mostrar tudo · {lines} linhas</button>}</div>;
}
