"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ALL_APP_MODES, APP_SECTION_LABEL } from "@/features/utils/home-apps";
import type { AppEntry, HomeConfig } from "@/app/api/admin/home-config/route";

function buildDefault(): AppEntry[] {
  return ALL_APP_MODES.map((m, i) => ({ id: m.id, enabled: true, order: i, highlighted: false }));
}

// Derive display metadata from the shared constants
const APP_META = new Map(ALL_APP_MODES.map((m) => [m.id, m]));

// Collapses bursts of reorder/toggle clicks into a single PATCH.
const AUTOSAVE_DELAY_MS = 800;

export function AdminHomeConfigScreen() {
  const [entries, setEntries] = useState<AppEntry[]>(buildDefault());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void fetch("/api/admin/home-config", { credentials: "include" })
      .then((r) => r.json())
      .then((data: HomeConfig) => {
        // Merge saved config with current app list so new apps always appear
        const savedMap = new Map(data.apps.map((e) => [e.id, e]));
        const maxOrder = data.apps.reduce((max, e) => Math.max(max, e.order), -1);
        const merged = ALL_APP_MODES.map((m, i) => {
          return savedMap.get(m.id) ?? { id: m.id, enabled: true, order: maxOrder + i + 1, highlighted: false };
        });
        // Sort by saved order to preserve admin arrangement
        setEntries(merged.sort((a, b) => a.order - b.order));
      })
      .catch(() => setEntries(buildDefault()))
      .finally(() => {
        setLoading(false);
        // Marks the load as settled so the autosave effect below ignores this initial merge.
        hasLoadedRef.current = true;
      });
  }, []);

  // Re-number orders to be consecutive after any mutation
  function normalize(list: AppEntry[]): AppEntry[] {
    return list.map((e, i) => ({ ...e, order: i }));
  }

  function move(index: number, direction: -1 | 1) {
    const next = index + direction;
    if (next < 0 || next >= entries.length) return;
    const updated = [...entries];
    [updated[index], updated[next]] = [updated[next], updated[index]];
    setEntries(normalize(updated));
  }

  function toggle(id: string) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, enabled: !e.enabled } : e)));
  }

  function setHighlight(id: string) {
    // Only one card can be highlighted at a time
    setEntries((prev) => prev.map((e) => ({ ...e, highlighted: e.id === id ? !e.highlighted : false })));
  }

  const save = useCallback(async (toSave: AppEntry[]) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/home-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ apps: toSave } satisfies HomeConfig),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Erro ao salvar");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Falha na requisicao");
    } finally {
      setSaving(false);
    }
  }, []);

  // Auto-save whenever the config changes (reorder, toggle, highlight), debounced.
  useEffect(() => {
    if (!hasLoadedRef.current) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => void save(entries), AUTOSAVE_DELAY_MS);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [entries, save]);

  const visibleEntries = entries.filter((e) => e.enabled);

  if (loading) {
    return (
      <main className="space-y-5">
        <Header />
        <p className="text-xs text-[#94a3b8]">Carregando...</p>
      </main>
    );
  }
  return (
    <main className="space-y-5">
      <Header />

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        {/* Left: editable list */}
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-[10px] uppercase text-[#64748b]">Arraste ou use as setas para reordenar</p>
            <p className="font-mono text-[10px] uppercase shrink-0">
              {saving && <span className="text-[#64748b]">Salvando...</span>}
              {!saving && saved && <span className="text-green-500">Alteracoes salvas</span>}
              {!saving && error && <span className="text-red-400">{error}</span>}
            </p>
          </div>

          {entries.map((entry, index) => {
            const meta = APP_META.get(entry.id);
            if (!meta) return null;
            const section = APP_SECTION_LABEL[entry.id] ?? "";
            const isHighlighted = entry.highlighted;

            return (
              <div
                key={entry.id}
                className={`flex items-center gap-3 border bg-[#111827] px-3 py-2.5 transition-colors ${
                  entry.enabled ? "border-[#1e293b]" : "border-[#0f172a] opacity-50"
                } ${isHighlighted ? "border-yellow-600/50" : ""}`}
              >
                {/* Order arrows */}
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    className="text-[10px] text-[#64748b] hover:text-[#e2e8f0] disabled:opacity-20 leading-none"
                    aria-label="Mover para cima"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === entries.length - 1}
                    className="text-[10px] text-[#64748b] hover:text-[#e2e8f0] disabled:opacity-20 leading-none"
                    aria-label="Mover para baixo"
                  >
                    ▼
                  </button>
                </div>

                {/* App info */}
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-xs uppercase text-[#e2e8f0] truncate">{meta.title}</p>
                  <p className="text-[10px] text-[#64748b]">
                    /{entry.id} &middot; {section}
                  </p>
                </div>

                {/* Highlight toggle */}
                <button
                  type="button"
                  onClick={() => setHighlight(entry.id)}
                  title={isHighlighted ? "Remover destaque" : "Marcar como destaque"}
                  className={`text-base leading-none shrink-0 transition-colors ${
                    isHighlighted ? "text-yellow-400" : "text-[#334155] hover:text-yellow-600"
                  }`}
                >
                  ★
                </button>

                {/* Enable toggle */}
                <button
                  type="button"
                  onClick={() => toggle(entry.id)}
                  className={`shrink-0 w-10 h-5 rounded-full border transition-colors relative ${
                    entry.enabled ? "bg-green-800 border-green-600" : "bg-[#0f172a] border-[#1e293b]"
                  }`}
                  aria-label={entry.enabled ? "Desativar" : "Ativar"}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                      entry.enabled ? "left-5" : "left-0.5"
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </section>

        {/* Right: preview */}
        <aside className="space-y-2">
          <p className="font-mono text-[10px] uppercase text-[#64748b]">Preview — tela inicial</p>
          <div className="border border-[#1e293b] bg-[#0b1220] p-3 space-y-1.5">
            {visibleEntries.length === 0 ? (
              <p className="text-xs text-[#64748b] text-center py-4">Nenhum card ativo</p>
            ) : (
              visibleEntries.map((entry) => {
                const meta = APP_META.get(entry.id);
                if (!meta) return null;
                return (
                  <div
                    key={entry.id}
                    className={`flex items-center gap-2 px-2 py-1.5 border ${
                      entry.highlighted ? "border-yellow-600 bg-yellow-900/10" : "border-[#1e293b] bg-[#111827]"
                    }`}
                  >
                    {entry.highlighted && <span className="text-yellow-400 text-[10px]">★</span>}
                    <p className="font-mono text-[10px] uppercase text-[#e2e8f0] flex-1 truncate">{meta.title}</p>
                    <p className="text-[9px] text-[#64748b]">/{entry.id}</p>
                  </div>
                );
              })
            )}
          </div>
          <p className="text-[10px] text-[#64748b]">
            {visibleEntries.length} de {entries.length} cards visiveis
          </p>
        </aside>
      </div>
    </main>
  );
}

function Header() {
  return (
    <header className="space-y-1">
      <p className="font-mono text-xs uppercase text-[#f97316]">Config</p>
      <h1 className="font-mono text-sm uppercase text-[#f8fafc]">Home Screen — configuracao de cards</h1>
      <p className="text-xs text-[#94a3b8] max-w-1/2">
        Controle quais cards aparecem na tela inicial, a ordem de exibicao, e qual recebe destaque. Cards desativados
        ficam ocultos e o acesso direto pela URL e redirecionado para /home.
      </p>
    </header>
  );
}
