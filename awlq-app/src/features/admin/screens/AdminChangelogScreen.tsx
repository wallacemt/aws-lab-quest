"use client";

import { useCallback, useEffect, useState } from "react";

type Entry = { id: string; category: string; text: string };

type Release = {
  id: string;
  tagName: string;
  name: string | null;
  bodyMarkdown: string | null;
  adminSummary: string | null;
  highlight: boolean;
  published: boolean;
  releasedAt: string | null;
  entries: Entry[];
};

const PAGE_SIZE = 5;

export function AdminChangelogScreen() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editSummary, setEditSummary] = useState<Record<string, string>>({});
  const [editBody, setEditBody] = useState<Record<string, string>>({});
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [newEntry, setNewEntry] = useState<Record<string, { category: string; text: string }>>({});
  const [page, setPage] = useState(1);
  const [filterPublished, setFilterPublished] = useState<"" | "true" | "false">("");

  const loadReleases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/changelog", { credentials: "include" });
      if (!res.ok) throw new Error("Falha ao carregar changelog");
      const data = (await res.json()) as { releases: Release[] };
      setReleases(data.releases ?? []);
      const summaries: Record<string, string> = {};
      const bodies: Record<string, string> = {};
      for (const r of data.releases ?? []) {
        summaries[r.id] = r.adminSummary ?? "";
        bodies[r.id] = r.bodyMarkdown ?? "";
      }
      setEditSummary(summaries);
      setEditBody(bodies);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReleases();
  }, [loadReleases]);

  async function syncNow() {
    setSyncing(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/changelog/sync", {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        setMessage("Sync enfileirado. Atualize a página em alguns segundos.");
      } else {
        setMessage("Erro ao sincronizar com GitHub.");
      }
    } finally {
      setSyncing(false);
    }
  }

  async function updateRelease(
    release: Release,
    patch: Partial<Pick<Release, "published" | "highlight" | "adminSummary" | "bodyMarkdown">>,
  ) {
    await fetch(`/api/admin/changelog/${release.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(patch),
    });
    void loadReleases();
  }

  async function addEntry(releaseId: string) {
    const entry = newEntry[releaseId];
    if (!entry?.category || !entry.text) return;
    await fetch(`/api/admin/changelog/${releaseId}/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(entry),
    });
    setNewEntry((p) => ({ ...p, [releaseId]: { category: "", text: "" } }));
    void loadReleases();
  }

  async function deleteEntry(releaseId: string, entryId: string) {
    await fetch(`/api/admin/changelog/${releaseId}/entries?entryId=${entryId}`, {
      method: "DELETE",
      credentials: "include",
    });
    void loadReleases();
  }

  async function deleteRelease(releaseId: string) {
    if (!window.confirm("Remover esta release permanentemente?")) return;
    await fetch(`/api/admin/changelog/${releaseId}`, {
      method: "DELETE",
      credentials: "include",
    });
    void loadReleases();
  }

  function toggleCollapse(releaseId: string) {
    setCollapsed((p) => ({ ...p, [releaseId]: !p[releaseId] }));
  }

  const filtered = filterPublished === "" ? releases : releases.filter((r) => String(r.published) === filterPublished);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <main className="space-y-5">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase text-[#f97316]">Changelog</p>
        <h1 className="font-mono text-sm uppercase text-[#f8fafc]">Gerenciar Releases</h1>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void loadReleases()}
            disabled={loading}
            className="border border-[#334155] px-3 py-1 text-xs uppercase text-[#e2e8f0] disabled:opacity-50"
          >
            Atualizar
          </button>
          <button
            type="button"
            onClick={() => void syncNow()}
            disabled={syncing}
            className="border border-[#38bdf8] px-3 py-1 text-xs uppercase text-[#38bdf8] disabled:opacity-50"
          >
            {syncing ? "Sincronizando..." : "Sync GitHub"}
          </button>
          {releases.length > 0 && (
            <span className="font-mono text-xs text-[#64748b]">{releases.length} release(s)</span>
          )}
        </div>
      </header>

      {message && <p className="font-mono text-xs text-[#86efac]">{message}</p>}
      {error && <p className="font-mono text-xs text-[#fca5a5]">{error}</p>}

      {/* Filters */}
      <section className="border border-[#1e293b] bg-[#111827] p-4">
        <div className="flex flex-wrap gap-3">
          <select
            value={filterPublished}
            onChange={(e) => {
              setFilterPublished(e.target.value as "" | "true" | "false");
              setPage(1);
            }}
            className="border border-[#334155] bg-[#0b1220] px-3 py-2 text-xs text-[#e2e8f0] focus:outline-none"
          >
            <option value="">Todas</option>
            <option value="true">Publicadas</option>
            <option value="false">Não publicadas</option>
          </select>
        </div>
      </section>

      {/* Release list */}
      {loading ? (
        <p className="font-mono text-xs text-[#94a3b8]">Carregando...</p>
      ) : (
        <>
          <div className="space-y-4">
            {paginated.map((release) => (
              <section key={release.id} className="border border-[#1e293b] bg-[#111827]">
                {/* Release header — always visible */}
                <div className="flex items-center justify-between gap-4 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleCollapse(release.id)}
                    className="flex items-center gap-2 text-left flex-1 min-w-0"
                    aria-expanded={!collapsed[release.id]}
                  >
                    <span className="font-mono text-xs text-[#94a3b8] shrink-0">
                      {collapsed[release.id] ? "▶" : "▼"}
                    </span>
                    <span className="font-mono text-sm text-[#f97316]">{release.tagName}</span>
                    {release.name && <span className="font-mono text-xs text-[#e2e8f0] truncate">{release.name}</span>}
                    {release.releasedAt && (
                      <span className="font-mono text-[10px] text-[#94a3b8] shrink-0">
                        {new Date(release.releasedAt).toLocaleDateString("pt-BR")}
                      </span>
                    )}
                  </button>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void updateRelease(release, { highlight: !release.highlight })}
                      className={`border px-3 py-1.5 font-mono text-[10px] uppercase ${
                        release.highlight ? "border-[#f97316] text-[#f97316]" : "border-[#334155] text-[#94a3b8]"
                      }`}
                    >
                      Destaque
                    </button>
                    <button
                      type="button"
                      onClick={() => void updateRelease(release, { published: !release.published })}
                      className={`border px-3 py-1.5 font-mono text-[10px] uppercase ${
                        release.published
                          ? "border-[#14532d] bg-green-900/20 text-green-300"
                          : "border-[#334155] text-[#94a3b8]"
                      }`}
                    >
                      {release.published ? "Publicado" : "Publicar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteRelease(release.id)}
                      className="border border-red-900 px-3 py-1.5 font-mono text-[10px] uppercase text-red-500 hover:border-red-500 transition-colors"
                    >
                      Remover
                    </button>
                  </div>
                </div>

                {/* Collapsible body */}
                {!collapsed[release.id] && (
                  <div className="border-t border-[#1e293b] px-4 pb-4 pt-3 space-y-4">
                    {/* Body markdown */}
                    <div>
                      <label className="block font-mono text-[10px] uppercase text-[#94a3b8] mb-1">
                        Body (markdown do GitHub)
                      </label>
                      <div className="flex gap-2">
                        <textarea
                          rows={5}
                          className="flex-1 border border-[#334155] bg-[#0b1220] px-3 py-2 font-mono text-xs text-[#e2e8f0] focus:border-[#f97316] focus:outline-none resize-y"
                          value={editBody[release.id] ?? ""}
                          onChange={(e) => setEditBody((p) => ({ ...p, [release.id]: e.target.value }))}
                        />
                        <button
                          type="button"
                          onClick={() => void updateRelease(release, { bodyMarkdown: editBody[release.id] || null })}
                          className="border border-[#334155] px-3 font-mono text-[10px] uppercase text-[#cbd5e1] hover:border-[#f97316] hover:text-[#f97316] transition-colors"
                        >
                          Salvar
                        </button>
                      </div>
                    </div>

                    {/* Admin summary */}
                    <div>
                      <label className="block font-mono text-[10px] uppercase text-[#94a3b8] mb-1">
                        Resumo admin (exibido no público se preenchido)
                      </label>
                      <div className="flex gap-2">
                        <textarea
                          rows={2}
                          className="flex-1 border border-[#334155] bg-[#0b1220] px-3 py-2 font-mono text-xs text-[#e2e8f0] focus:border-[#f97316] focus:outline-none resize-none"
                          value={editSummary[release.id] ?? ""}
                          onChange={(e) => setEditSummary((p) => ({ ...p, [release.id]: e.target.value }))}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            void updateRelease(release, {
                              adminSummary: editSummary[release.id] || null,
                            })
                          }
                          className="border border-[#334155] px-3 font-mono text-[10px] uppercase text-[#cbd5e1] hover:border-[#f97316] hover:text-[#f97316] transition-colors"
                        >
                          Salvar
                        </button>
                      </div>
                    </div>

                    {/* Entries */}
                    <div className="space-y-2">
                      <p className="font-mono text-[10px] uppercase text-[#94a3b8]">
                        Entradas ({release.entries.length})
                      </p>
                      {release.entries.map((entry) => (
                        <div
                          key={entry.id}
                          className="flex items-center gap-2 border border-[#1e293b] bg-[#0b1220] px-3 py-2"
                        >
                          <span className="font-mono text-[10px] text-[#f97316] uppercase shrink-0">
                            [{entry.category}]
                          </span>
                          <span className="flex-1 font-mono text-[10px] text-[#cbd5e1]">{entry.text}</span>
                          <button
                            type="button"
                            onClick={() => void deleteEntry(release.id, entry.id)}
                            className="shrink-0 font-mono text-[10px] text-red-400 hover:text-red-300 transition-colors"
                          >
                            Remover
                          </button>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <input
                          placeholder="categoria"
                          className="w-28 border border-[#334155] bg-[#0b1220] px-2 py-1.5 font-mono text-[10px] text-[#e2e8f0] focus:border-[#f97316] focus:outline-none"
                          value={newEntry[release.id]?.category ?? ""}
                          onChange={(e) =>
                            setNewEntry((p) => ({
                              ...p,
                              [release.id]: { ...p[release.id], category: e.target.value },
                            }))
                          }
                        />
                        <input
                          placeholder="texto da entrada"
                          className="flex-1 border border-[#334155] bg-[#0b1220] px-2 py-1.5 font-mono text-[10px] text-[#e2e8f0] focus:border-[#f97316] focus:outline-none"
                          value={newEntry[release.id]?.text ?? ""}
                          onChange={(e) =>
                            setNewEntry((p) => ({
                              ...p,
                              [release.id]: { ...p[release.id], text: e.target.value },
                            }))
                          }
                        />
                        <button
                          type="button"
                          onClick={() => void addEntry(release.id)}
                          className="border border-[#334155] px-3 font-mono text-[10px] uppercase text-[#cbd5e1] hover:border-[#f97316] hover:text-[#f97316] transition-colors"
                        >
                          + Adicionar
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            ))}

            {paginated.length === 0 && !loading && (
              <p className="font-mono text-xs text-[#64748b]">Nenhuma release encontrada.</p>
            )}
          </div>

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
