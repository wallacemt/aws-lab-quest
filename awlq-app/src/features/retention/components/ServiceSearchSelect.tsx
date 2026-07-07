"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { PixelButton } from "@/components/ui/pixel-button";
import { StudyServiceItem } from "@/features/study/services/study-api";

type Props = {
  services: StudyServiceItem[];
  value: string;
  onChange: (id: string) => void;
};

function normalizeForSearch(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/**
 * Searchable single-select for AWS services, mirroring the admin
 * ServiceMultiSelect's search/filter behavior but pixel-themed and
 * single-value (a flashcard has one optional awsServiceId).
 */
export function ServiceSearchSelect({ services, value, onChange }: Props) {
  const [search, setSearch] = useState("");
  const selected = services.find((s) => s.id === value);

  const filtered = useMemo(() => {
    const q = normalizeForSearch(search);
    if (!q) return services;
    return services
      .filter((s) => normalizeForSearch(`${s.code} ${s.name}`).includes(q))
      .sort((a, b) => {
        const aStarts = normalizeForSearch(a.code).startsWith(q) ? 1 : 0;
        const bStarts = normalizeForSearch(b.code).startsWith(q) ? 1 : 0;
        return bStarts - aStarts || a.code.localeCompare(b.code, "pt-BR");
      });
  }, [services, search]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Buscar serviço AWS por nome ou código..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {selected && (
          <PixelButton
            type="button"
            variant="ghost"
            onClick={() => {
              onChange("");
              setSearch("");
            }}
          >
            Limpar
          </PixelButton>
        )}
      </div>

      {selected && (
        <p className="font-mono text-xs text-[var(--pixel-accent)]">
          Selecionado: {selected.code} — {selected.name}
        </p>
      )}

      <div className="max-h-40 overflow-auto border-2 border-[var(--pixel-border)] bg-[var(--pixel-card)] p-2">
        <div className="flex flex-col gap-1">
          {filtered.map((service) => (
            <button
              key={service.id}
              type="button"
              onClick={() => onChange(service.id === value ? "" : service.id)}
              className={`flex items-center gap-2 px-2 py-1 text-left font-mono text-xs transition-colors ${
                service.id === value
                  ? "bg-[var(--pixel-accent)] text-black"
                  : "text-[var(--pixel-text)] hover:bg-[var(--pixel-muted)]"
              }`}
            >
              <span className={`uppercase ${service.id === value ? "" : "text-[var(--pixel-subtext)]"}`}>
                {service.code}
              </span>
              <span className="truncate">{service.name}</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="p-2 font-mono text-xs text-[var(--pixel-subtext)]">Nenhum serviço encontrado.</p>
          )}
        </div>
      </div>
    </div>
  );
}
