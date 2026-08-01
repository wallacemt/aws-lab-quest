"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getContextualLibrarySuggestions } from "@/features/library/services/library-api";
import type { LibraryContentLite } from "@/features/library/types";

const TYPE_LABELS: Record<string, string> = {
  PDF: "PDF",
  IMAGE: "Imagem",
  MARKDOWN: "Artigo",
  SLIDES: "Slides",
};

type Props = {
  awsServiceId?: string | null;
  questChainId?: string | null;
  heading: string;
};

/**
 * Self-fetching "Sugestões da Biblioteca" block — drop into any screen (client
 * or server) with a service code and/or quest chain id in scope. Renders
 * nothing while loading or when there's no matching published content, so it
 * never shows empty-state noise.
 */
export function ContextualLibrarySuggestions({ awsServiceId, questChainId, heading }: Props) {
  const [items, setItems] = useState<LibraryContentLite[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (!awsServiceId && !questChainId) {
      setItems([]);
      return;
    }

    getContextualLibrarySuggestions({
      awsServiceId: awsServiceId ?? undefined,
      questChainId: questChainId ?? undefined,
    })
      .then((result) => {
        if (!cancelled) setItems(result);
      })
      .catch(() => {
        // Sugestões são um extra — falha silenciosa não bloqueia a tela.
      });

    return () => {
      cancelled = true;
    };
  }, [awsServiceId, questChainId]);

  if (items.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-mono text-xs uppercase tracking-wide text-[var(--pixel-muted)]">{heading}</h2>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={`/biblioteca/${item.id}`}
              className="flex items-start gap-3 rounded border border-[var(--pixel-border)] bg-[var(--pixel-surface)] p-3 transition-colors hover:border-[var(--pixel-accent)] hover:bg-[var(--pixel-accent)]/5"
            >
              <span className="mt-0.5 flex-shrink-0 font-mono text-[10px] uppercase tracking-wider text-[var(--pixel-accent)]">
                {TYPE_LABELS[item.type] ?? item.type}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-xs font-bold text-[var(--pixel-text)] line-clamp-1">{item.title}</p>
                {item.description && (
                  <p className="mt-0.5 font-mono text-[10px] text-[var(--pixel-muted)] line-clamp-1">
                    {item.description}
                  </p>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
