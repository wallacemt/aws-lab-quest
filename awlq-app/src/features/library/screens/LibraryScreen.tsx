"use client";

import { useCallback, useMemo, useState } from "react";
import { ContentCard } from "@/features/library/components/ContentCard";
import type { LibraryContentLite } from "@/features/library/types";
import type { LibraryContentType } from "@prisma/client";

const CATEGORIES = [
  "Todos",
  "Practitioner",
  "SAA",
  "Developer",
  "SysOps",
  "Security",
  "Networking",
  "Database",
  "Serverless",
] as const;

const TYPE_OPTIONS: { label: string; value: LibraryContentType | "Todos" }[] = [
  { label: "Todos", value: "Todos" },
  { label: "PDF", value: "PDF" },
  { label: "Artigo", value: "MARKDOWN" },
  { label: "Imagem", value: "IMAGE" },
  { label: "Slides", value: "SLIDES" },
];

interface LibraryScreenProps {
  initialContent: LibraryContentLite[];
}

export function LibraryScreen({ initialContent }: LibraryScreenProps) {
  const [activeCategory, setActiveCategory] = useState<string>("Todos");
  const [activeType, setActiveType] = useState<LibraryContentType | "Todos">("Todos");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const filtered = useMemo(() => {
    return initialContent.filter((item) => {
      if (activeCategory !== "Todos" && item.category !== activeCategory) return false;
      if (activeType !== "Todos" && item.type !== activeType) return false;
      if (
        searchQuery.trim() &&
        !item.title.toLowerCase().includes(searchQuery.trim().toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [initialContent, activeCategory, activeType, searchQuery]);

  const handleCategoryChange = useCallback((category: string) => {
    setActiveCategory(category);
  }, []);

  const handleTypeChange = useCallback((type: LibraryContentType | "Todos") => {
    setActiveType(type);
  }, []);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6">
      <h1 className="font-mono text-sm uppercase tracking-wide text-[var(--pixel-text)]">
        Biblioteca
      </h1>

      {/* Search */}
      <input
        type="search"
        placeholder="Buscar por título..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full rounded border border-[var(--pixel-border)] bg-[var(--pixel-surface)] px-3 py-2 font-mono text-xs text-[var(--pixel-text)] placeholder-[var(--pixel-muted)] focus:border-[var(--pixel-accent)] focus:outline-none"
      />

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => handleCategoryChange(cat)}
            className={`rounded border px-3 py-1 font-mono text-xs transition-colors ${
              activeCategory === cat
                ? "border-[var(--pixel-accent)] bg-[var(--pixel-accent)] text-[var(--pixel-bg)]"
                : "border-[var(--pixel-border)] text-[var(--pixel-muted)] hover:border-[var(--pixel-accent)] hover:text-[var(--pixel-accent)]"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Type filter */}
      <div className="flex flex-wrap gap-2">
        {TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleTypeChange(opt.value)}
            className={`rounded border px-3 py-1 font-mono text-xs transition-colors ${
              activeType === opt.value
                ? "border-[var(--pixel-accent)] bg-[var(--pixel-accent)] text-[var(--pixel-bg)]"
                : "border-[var(--pixel-border)] text-[var(--pixel-muted)] hover:border-[var(--pixel-accent)] hover:text-[var(--pixel-accent)]"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Content grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <p className="font-mono text-sm text-[var(--pixel-muted)]">
            Nenhum conteúdo disponível.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <ContentCard key={item.id} {...item} />
          ))}
        </div>
      )}
    </div>
  );
}
