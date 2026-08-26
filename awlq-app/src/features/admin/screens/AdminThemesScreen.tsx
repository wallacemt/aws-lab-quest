"use client";

import { useCallback, useEffect, useState } from "react";
import { listAdminThemes, setAdminThemePublic, deleteAdminTheme } from "@/features/admin/services/admin-api";
import type { AdminThemeListItem, PaginatedResult } from "@/features/admin/types";
import Image from "next/image";

const PAGE_SIZE = 20;
const SWATCH_KEYS = ["--pixel-bg", "--pixel-primary", "--pixel-accent", "--pixel-card", "--pixel-border"];

export function AdminThemesScreen() {
  const [search, setSearch] = useState("");
  const [isPublicFilter, setIsPublicFilter] = useState<"" | "true" | "false">("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<PaginatedResult<AdminThemeListItem> | null>(null);

  const loadThemes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listAdminThemes({
        page,
        pageSize: PAGE_SIZE,
        search: search || undefined,
        isPublic: isPublicFilter || undefined,
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar temas.");
    } finally {
      setLoading(false);
    }
  }, [page, search, isPublicFilter]);

  useEffect(() => {
    void loadThemes();
  }, [loadThemes]);

  async function handleTogglePublic(theme: AdminThemeListItem) {
    try {
      await setAdminThemePublic(theme.id, !theme.isPublic);
      setMessage(theme.isPublic ? "Tema despublicado." : "Tema publicado.");
      void loadThemes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao atualizar tema.");
    }
  }

  async function handleDelete(theme: AdminThemeListItem) {
    if (!confirm(`Excluir permanentemente o tema "${theme.name}" (de ${theme.user.name})?`)) return;
    try {
      await deleteAdminTheme(theme.id);
      setMessage("Tema excluido.");
      void loadThemes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao excluir tema.");
    }
  }

  return (
    <main className="space-y-5">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase text-[#f97316]">Gamificacao</p>
        <h1 className="font-mono text-sm uppercase text-[#f8fafc]">Temas da Comunidade</h1>
        <p className="font-[var(--font-body)] text-sm text-[#94a3b8]">
          Temas de personalizacao criados por usuarios. Publicados aparecem na galeria &ldquo;Comunidade&rdquo; para
          todos usarem.
        </p>
      </header>

      {message && <p className="font-mono text-xs text-[#86efac]">{message}</p>}
      {error && <p className="font-mono text-xs text-[#fca5a5]">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Buscar por nome do tema, usuario ou email..."
          className="min-w-[260px] flex-1 border border-[#334155] bg-[#0b1220] px-3 py-1.5 font-mono text-xs text-[#e2e8f0]"
        />
        <select
          className="border border-[#334155] bg-[#0b1220] px-3 py-1.5 font-mono text-xs text-[#e2e8f0]"
          value={isPublicFilter}
          onChange={(e) => {
            setIsPublicFilter(e.target.value as typeof isPublicFilter);
            setPage(1);
          }}
        >
          <option value="">Todos</option>
          <option value="true">Publicados</option>
          <option value="false">Privados</option>
        </select>
      </div>

      {loading ? (
        <p className="font-mono text-xs text-[#94a3b8]">Carregando temas...</p>
      ) : (
        <>
          <section className="overflow-x-auto border border-[#1e293b] bg-[#111827]">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-[#1e293b] bg-[#0f172a] text-xs uppercase text-[#94a3b8]">
                <tr>
                  <th className="px-3 py-2">Background (Imagem)</th>
                  <th className="px-3 py-2">Cores</th>
                  <th className="px-3 py-2">Nome</th>
                  <th className="px-3 py-2">Criado por</th>
                  <th className="px-3 py-2 text-center">Status</th>
                  <th className="px-3 py-2">Criado em</th>
                  <th className="px-3 py-2">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {(result?.items ?? []).map((theme) => (
                  <tr key={theme.id} className="border-b border-[#1e293b] text-[#e2e8f0] hover:bg-white/[0.02]">
                    {theme.bgImageUrl && (
                      <td className="px-3 py-2">
                        <div className="flex h-full w-full overflow-hidden border border-[#1e293b]">
                          <Image src={theme.bgImageUrl} alt="Background" width={120} height={40} />
                        </div>
                      </td>
                    )}
                    <td className="px-3 py-2">
                      <div className="flex h-6 w-24 overflow-hidden border border-[#1e293b]">
                        {SWATCH_KEYS.map((k) => (
                          <div key={k} className="flex-1" style={{ background: theme.colors[k] ?? "transparent" }} />
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-sm">{theme.name}</td>
                    <td className="px-3 py-2 text-xs text-[#94a3b8]">
                      <p>{theme.user.name}</p>
                      <p className="text-[#64748b]">
                        {theme.user.username ? `@${theme.user.username}` : theme.user.email}
                      </p>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={`border px-2 py-0.5 font-mono text-[10px] uppercase ${
                          theme.isPublic
                            ? "border-[#14532d] bg-green-900/20 text-green-300"
                            : "border-[#334155] text-[#64748b]"
                        }`}
                      >
                        {theme.isPublic ? "Publicado" : "Privado"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-[#94a3b8]">
                      {new Date(theme.createdAt).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void handleTogglePublic(theme)}
                          className="border border-[#334155] px-3 py-1 font-mono text-[10px] uppercase text-[#94a3b8] hover:border-[#f97316] hover:text-[#f97316] transition-colors"
                        >
                          {theme.isPublic ? "Despublicar" : "Publicar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(theme)}
                          className="border border-red-500/40 px-3 py-1 font-mono text-[10px] uppercase text-red-400"
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {(result?.items.length ?? 0) === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center font-mono text-xs text-[#64748b]">
                      Nenhum tema encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          {result && result.totalPages > 1 && (
            <footer className="flex items-center justify-between border border-[#1e293b] bg-[#111827] px-4 py-3 text-sm text-[#cbd5e1]">
              <span className="font-mono text-xs">
                Pagina {result.page} de {result.totalPages} | Total: {result.total}
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
                  disabled={page >= result.totalPages}
                  onClick={() => setPage((p) => Math.min(result.totalPages, p + 1))}
                  className="border border-[#334155] px-3 py-1 text-xs uppercase disabled:opacity-40"
                >
                  Proxima
                </button>
              </div>
            </footer>
          )}
        </>
      )}
    </main>
  );
}
