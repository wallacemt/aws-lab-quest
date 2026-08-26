"use client";

import { useState } from "react";

type Props<T> = {
  endpoint: string;
  body?: Record<string, unknown>;
  renderSuggestion: (item: T) => { title: React.ReactNode; subtitle?: React.ReactNode };
  onApply: (item: T) => void;
};

/**
 * "Sugerir com IA" panel reused across admin create forms (achievements,
 * trails, arena bosses, weekly challenge): fetches candidates from `endpoint`,
 * lets the admin review them, and hands the picked one to `onApply` — never
 * saves anything itself.
 */
export function AiSuggestionPanel<T>({ endpoint, body, renderSuggestion, onApply }: Props<T>) {
  const [suggestions, setSuggestions] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSuggest() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body ?? { count: 3 }),
      });
      const data = (await res.json()) as { candidates?: T[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Falha ao gerar sugestoes");
      setSuggestions(data.candidates ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar sugestoes.");
    } finally {
      setLoading(false);
    }
  }

  function apply(item: T) {
    onApply(item);
    setSuggestions([]);
  }

  return (
    <section className="space-y-2 border border-dashed border-[#1e3a5f] bg-[#0b1220] p-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase text-[#38bdf8]">✦ Sugestao via IA</span>
        <button
          type="button"
          onClick={() => void handleSuggest()}
          disabled={loading}
          className="border border-[#1e3a5f] bg-[#0f172a] px-3 py-1 font-mono text-[10px] uppercase text-[#38bdf8] hover:bg-[#1e3a5f]/30 disabled:opacity-40"
        >
          {loading ? "Gerando..." : "Sugerir com IA"}
        </button>
      </div>

      {error && <p className="font-mono text-[10px] text-[#fca5a5]">{error}</p>}

      {suggestions.map((item, index) => {
        const { title, subtitle } = renderSuggestion(item);
        return (
          <div
            key={index}
            className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1e293b] py-2 last:border-0"
          >
            <div>
              <p className="text-xs text-[#e2e8f0]">{title}</p>
              {subtitle && <p className="text-[10px] text-[#94a3b8]">{subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={() => apply(item)}
              className="border border-[#334155] px-3 py-1 font-mono text-[10px] uppercase text-[#94a3b8] hover:border-[#f97316] hover:text-[#f97316]"
            >
              Usar
            </button>
          </div>
        );
      })}
    </section>
  );
}
