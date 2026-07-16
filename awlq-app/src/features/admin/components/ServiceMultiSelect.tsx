"use client";

import { useMemo, useState } from "react";

export type ServiceOption = { id: string; code: string; name: string };

type Props = {
  allServices: ServiceOption[];
  selectedCodes: string[];
  onChange: (codes: string[]) => void;
  /** Single-choice mode (e.g. a boss's theme service): picking an item replaces the selection instead of adding to it. */
  single?: boolean;
};

function normalizeForSearch(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export function ServiceMultiSelect({ allServices, selectedCodes, onChange, single = false }: Props) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = normalizeForSearch(search);
    if (!q) return allServices;
    return allServices
      .filter((s) => normalizeForSearch(`${s.code} ${s.name}`).includes(q))
      .sort((a, b) => {
        const aS = normalizeForSearch(a.code).startsWith(q) ? 1 : 0;
        const bS = normalizeForSearch(b.code).startsWith(q) ? 1 : 0;
        return bS - aS || a.code.localeCompare(b.code, "pt-BR");
      });
  }, [allServices, search]);

  function toggle(code: string) {
    if (single) {
      onChange(selectedCodes[0] === code ? [] : [code]);
      return;
    }
    onChange(
      selectedCodes.includes(code)
        ? selectedCodes.filter((c) => c !== code)
        : [...selectedCodes, code],
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={search}
          placeholder="Pesquisar por nome ou código"
          className="flex-1 border border-[#334155] bg-[#0b1220] px-3 py-1 text-sm text-[#e2e8f0] outline-none"
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="border border-[#334155] px-2 py-1 text-[10px] uppercase text-[#94a3b8]"
          >
            Limpar
          </button>
        )}
      </div>
      {selectedCodes.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedCodes.map((code) => (
            <span
              key={code}
              className="flex items-center gap-1 rounded border border-[#334155] bg-[#1e293b] px-2 py-0.5 text-[10px] text-[#38bdf8]"
            >
              {code}
              <button
                type="button"
                onClick={() => toggle(code)}
                className="ml-0.5 text-[#64748b] hover:text-[#e2e8f0]"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="max-h-40 overflow-auto rounded border border-[#334155] bg-[#0b1220] p-2">
        <div className="grid gap-1.5 md:grid-cols-2">
          {filtered.map((svc) => (
            <label key={svc.code} className="inline-flex cursor-pointer items-center gap-2 text-xs">
              <input
                type={single ? "radio" : "checkbox"}
                name={single ? "service-single-select" : undefined}
                checked={selectedCodes.includes(svc.code)}
                onChange={() => toggle(svc.code)}
              />
              <span className="truncate">
                <span className="font-mono text-[#94a3b8]">{svc.code}</span>
                {" "}
                <span className="text-[#64748b]">- {svc.name}</span>
              </span>
            </label>
          ))}
        </div>
        {filtered.length === 0 && (
          <p className="p-2 text-xs text-[#94a3b8]">Nenhum serviço encontrado.</p>
        )}
      </div>
    </div>
  );
}
