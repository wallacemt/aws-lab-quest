"use client";

import { useCallback, useEffect, useState } from "react";

type NewsSource = {
  id: string;
  name: string;
  feedUrl: string;
  category: string;
  active: boolean;
  lastFetchedAt: string | null;
};

const PAGE_SIZE = 10;

const CATEGORIES = ["cloud", "security", "aws", "devops", "ai", "general"];

export function AdminNoticiasScreen() {
  const [sources, setSources] = useState<NewsSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", feedUrl: "", category: "cloud" });
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<Partial<Pick<NewsSource, "name" | "feedUrl" | "category">>>({});
  const [page, setPage] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState("");

  const loadSources = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/news-sources", { credentials: "include" });
      const data = (await res.json()) as { sources?: NewsSource[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Falha ao carregar fontes");
      setSources(data.sources ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar fontes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSources();
  }, [loadSources]);

  async function handleCreate() {
    setSaving(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/admin/news-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Erro ao criar fonte");
      setForm({ name: "", feedUrl: "", category: "cloud" });
      setMessage("Fonte adicionada com sucesso.");
      void loadSources();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Erro ao criar fonte.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(source: NewsSource) {
    await fetch(`/api/admin/news-sources/${source.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ active: !source.active }),
    });
    void loadSources();
  }

  async function handleSaveEdit(source: NewsSource) {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/news-sources/${source.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: editState.name ?? source.name,
          feedUrl: editState.feedUrl ?? source.feedUrl,
          category: editState.category ?? source.category,
        }),
      });
      if (!res.ok) throw new Error("Falha ao salvar");
      setEditingId(null);
      setEditState({});
      setMessage("Fonte atualizada.");
      void loadSources();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remover fonte de notícias?")) return;
    await fetch(`/api/admin/news-sources/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    void loadSources();
  }

  const filtered = categoryFilter
    ? sources.filter((s) => s.category === categoryFilter)
    : sources;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <main className="space-y-5">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase text-[#f97316]">Notícias</p>
        <h1 className="font-mono text-sm uppercase text-[#f8fafc]">Fontes RSS</h1>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void loadSources()}
            disabled={loading}
            className="border border-[#334155] px-3 py-1 text-xs uppercase text-[#e2e8f0] disabled:opacity-50"
          >
            Atualizar
          </button>
          {sources.length > 0 && (
            <span className="font-mono text-xs text-[#64748b]">{sources.length} fonte(s) cadastradas</span>
          )}
        </div>
      </header>

      {message && <p className="font-mono text-xs text-[#86efac]">{message}</p>}
      {error && <p className="font-mono text-xs text-[#fca5a5]">{error}</p>}

      {/* Create form */}
      <section className="border border-[#1e293b] bg-[#111827] p-4 space-y-4">
        <p className="font-mono text-xs uppercase text-[#94a3b8]">Adicionar Fonte</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="block font-mono text-[10px] uppercase text-[#94a3b8] mb-1">Nome</label>
            <input
              className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 font-mono text-xs text-[#e2e8f0] focus:border-[#f97316] focus:outline-none"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Ex: AWS Blog"
            />
          </div>
          <div>
            <label className="block font-mono text-[10px] uppercase text-[#94a3b8] mb-1">URL do Feed</label>
            <input
              className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 font-mono text-xs text-[#e2e8f0] focus:border-[#f97316] focus:outline-none"
              value={form.feedUrl}
              onChange={(e) => setForm((p) => ({ ...p, feedUrl: e.target.value }))}
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="block font-mono text-[10px] uppercase text-[#94a3b8] mb-1">Categoria</label>
            <select
              className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 font-mono text-xs text-[#e2e8f0] focus:border-[#f97316] focus:outline-none"
              value={form.category}
              onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
        {createError && <p className="font-mono text-xs text-[#fca5a5]">{createError}</p>}
        <button
          type="button"
          onClick={() => void handleCreate()}
          disabled={saving || !form.name || !form.feedUrl}
          className="border border-[#f97316] px-4 py-2 font-mono text-xs uppercase text-[#f97316] disabled:opacity-50"
        >
          {saving ? "Salvando..." : "Adicionar"}
        </button>
      </section>

      {/* Filters */}
      <section className="border border-[#1e293b] bg-[#111827] p-4">
        <div className="flex flex-wrap gap-3">
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            className="border border-[#334155] bg-[#0b1220] px-3 py-2 text-xs text-[#e2e8f0] focus:outline-none"
          >
            <option value="">Todas as categorias</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </section>

      {/* List */}
      {loading ? (
        <p className="font-mono text-xs text-[#94a3b8]">Carregando fontes...</p>
      ) : (
        <>
          <section className="overflow-x-auto border border-[#1e293b] bg-[#111827]">
            <table className="w-full min-w-[650px] text-left text-sm">
              <thead className="border-b border-[#1e293b] bg-[#0f172a] text-xs uppercase text-[#94a3b8]">
                <tr>
                  <th className="px-3 py-2">Nome</th>
                  <th className="px-3 py-2">Feed URL</th>
                  <th className="px-3 py-2">Categoria</th>
                  <th className="px-3 py-2">Última busca</th>
                  <th className="px-3 py-2 text-center">Status</th>
                  <th className="px-3 py-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((src) => (
                  <tr key={src.id} className="border-b border-[#1e293b] text-[#e2e8f0] hover:bg-white/[0.02]">
                    {editingId === src.id ? (
                      <>
                        <td className="px-3 py-2">
                          <input
                            className="w-full border border-[#334155] bg-[#0b1220] px-2 py-1.5 font-mono text-xs text-[#e2e8f0] focus:border-[#f97316] focus:outline-none"
                            value={editState.name ?? src.name}
                            onChange={(e) => setEditState((p) => ({ ...p, name: e.target.value }))}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            className="w-full border border-[#334155] bg-[#0b1220] px-2 py-1.5 font-mono text-xs text-[#e2e8f0] focus:border-[#f97316] focus:outline-none"
                            value={editState.feedUrl ?? src.feedUrl}
                            onChange={(e) => setEditState((p) => ({ ...p, feedUrl: e.target.value }))}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <select
                            className="border border-[#334155] bg-[#0b1220] px-2 py-1.5 font-mono text-xs text-[#e2e8f0] focus:border-[#f97316] focus:outline-none"
                            value={editState.category ?? src.category}
                            onChange={(e) => setEditState((p) => ({ ...p, category: e.target.value }))}
                          >
                            {CATEGORIES.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2 text-xs text-[#64748b]">
                          {src.lastFetchedAt
                            ? new Date(src.lastFetchedAt).toLocaleDateString("pt-BR")
                            : "nunca"}
                        </td>
                        <td className="px-3 py-2 text-center" />
                        <td className="px-3 py-2">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => void handleSaveEdit(src)}
                              disabled={saving}
                              className="border border-[#22c55e] px-3 py-1 font-mono text-[10px] uppercase text-[#22c55e] disabled:opacity-50"
                            >
                              Salvar
                            </button>
                            <button
                              type="button"
                              onClick={() => { setEditingId(null); setEditState({}); }}
                              className="border border-[#334155] px-3 py-1 font-mono text-[10px] uppercase text-[#94a3b8]"
                            >
                              Cancelar
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-2 font-mono text-xs">{src.name}</td>
                        <td className="px-3 py-2 max-w-[200px]">
                          <p className="truncate font-mono text-[10px] text-[#94a3b8]">{src.feedUrl}</p>
                        </td>
                        <td className="px-3 py-2">
                          <span className="border border-[#334155] px-1.5 py-0.5 font-mono text-[10px] uppercase text-[#64748b]">
                            {src.category}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-[#64748b]">
                          {src.lastFetchedAt
                            ? new Date(src.lastFetchedAt).toLocaleDateString("pt-BR")
                            : "nunca"}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => void toggleActive(src)}
                            className={`border px-2 py-0.5 font-mono text-[10px] uppercase ${
                              src.active
                                ? "border-[#14532d] bg-green-900/20 text-green-300"
                                : "border-[#334155] text-[#64748b]"
                            }`}
                          >
                            {src.active ? "Ativa" : "Inativa"}
                          </button>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => { setEditingId(src.id); setEditState({}); }}
                              className="border border-[#334155] px-3 py-1 font-mono text-[10px] uppercase text-[#94a3b8] hover:border-[#f97316] hover:text-[#f97316] transition-colors"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(src.id)}
                              className="border border-red-500/40 px-3 py-1 font-mono text-[10px] uppercase text-red-400"
                            >
                              Remover
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
                {paginated.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center font-mono text-xs text-[#64748b]">
                      Nenhuma fonte cadastrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          {totalPages > 1 && (
            <footer className="flex items-center justify-between border border-[#1e293b] bg-[#111827] px-4 py-3 text-sm text-[#cbd5e1]">
              <span className="font-mono text-xs">
                Página {page} de {totalPages} | Total: {filtered.length}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="border border-[#334155] px-3 py-1 text-xs uppercase disabled:opacity-40"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="border border-[#334155] px-3 py-1 text-xs uppercase disabled:opacity-40"
                >
                  Próxima
                </button>
              </div>
            </footer>
          )}
        </>
      )}
    </main>
  );
}
