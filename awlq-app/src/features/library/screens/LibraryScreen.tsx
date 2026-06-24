"use client";

import { useCallback, useMemo, useState } from "react";
import { PixelCard } from "@/components/ui/pixel-card";
import { PixelButton } from "@/components/ui/pixel-button";
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

const TYPE_OPTIONS: { label: string; value: LibraryContentType | "Todos"; tooltip: string }[] = [
  { label: "Todos", value: "Todos", tooltip: "Exibir todos os tipos de conteúdo" },
  { label: "PDF", value: "PDF", tooltip: "Filtrar por documentos PDF" },
  { label: "Artigo", value: "MARKDOWN", tooltip: "Filtrar por artigos em texto" },
  { label: "Imagem", value: "IMAGE", tooltip: "Filtrar por imagens e infográficos" },
  { label: "Slides", value: "SLIDES", tooltip: "Filtrar por apresentações" },
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

  const hasActiveFilters = activeCategory !== "Todos" || activeType !== "Todos" || searchQuery.trim().length > 0;

  function clearFilters() {
    setActiveCategory("Todos");
    setActiveType("Todos");
    setSearchQuery("");
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6">
      {/* Header */}
      <PixelCard>
        <h1 className="font-mono text-sm uppercase text-[var(--pixel-primary)]">Biblioteca</h1>
        <p className="mt-1 font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
          Materiais de estudo, artigos e infográficos selecionados para sua jornada AWS.
        </p>
      </PixelCard>

      {/* Filters */}
      <PixelCard className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--pixel-accent)]">
            Filtros
          </p>
          {hasActiveFilters && (
            <PixelButton variant="ghost" className="text-[10px]" onClick={clearFilters}>
              Limpar filtros
            </PixelButton>
          )}
        </div>

        {/* Search */}
        <input
          type="search"
          placeholder="Buscar por título..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full border border-[var(--pixel-border)] bg-[var(--pixel-card)] px-3 py-2 font-mono text-xs text-[var(--pixel-text)] placeholder-[var(--pixel-subtext)] focus:border-[var(--pixel-text)] focus:outline-none"
          aria-label="Buscar conteúdo"
        />

        {/* Category filter */}
        <div>
          <p className="mb-2 font-mono text-[10px] text-[var(--pixel-accent)] uppercase">Categoria</p>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                title={`Filtrar por categoria: ${cat}`}
                onClick={() => handleCategoryChange(cat)}
                className={`border px-3 py-1 font-mono text-xs transition-colors ${
                  activeCategory === cat
                    ? "border-[var(--pixel-accent)] bg-[var(--pixel-accent)] text-[var(--pixel-bg)]"
                    : "border-[var(--pixel-border)] text-[var(--pixel-subtext)] hover:border-[var(--pixel-accent)] hover:text-[var(--pixel-accent)]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Type filter */}
        <div>
          <p className="mb-2 font-mono text-[10px] text-[var(--pixel-muted)] uppercase">Tipo</p>
          <div className="flex flex-wrap gap-2">
            {TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                title={opt.tooltip}
                onClick={() => handleTypeChange(opt.value)}
                className={`border px-3 py-1 font-mono text-xs transition-colors ${
                  activeType === opt.value
                    ? "border-[var(--pixel-accent)] bg-[var(--pixel-accent)] text-[var(--pixel-bg)]"
                    : "border-[var(--pixel-border)] text-[var(--pixel-subtext)] hover:border-[var(--pixel-accent)] hover:text-[var(--pixel-accent)]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </PixelCard>

      {/* Results count */}
      <p className="font-mono text-[10px] text-[var(--pixel-subtext)]">
        {filtered.length} {filtered.length === 1 ? "item encontrado" : "itens encontrados"}
        {hasActiveFilters ? " (com filtros ativos)" : ""}
      </p>

      {/* Content grid */}
      {filtered.length === 0 ? (
        <PixelCard className="text-center py-8">
          <p className="font-mono text-sm text-[var(--pixel-subtext)]">
            Nenhum conteúdo encontrado com os filtros selecionados.
          </p>
          {hasActiveFilters && (
            <PixelButton variant="ghost" className="mt-3 text-xs" onClick={clearFilters}>
              Limpar filtros
            </PixelButton>
          )}
        </PixelCard>
      ) : (
        <div className="grid grid-cols-1 gap-4   lg:grid-cols-2">
          {filtered.map((item) => (
            <ContentCard key={item.id} {...item} />
          ))}
        </div>
      )}
    </div>
  );
}
