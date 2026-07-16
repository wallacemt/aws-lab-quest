"use client";

import { useCallback, useEffect, useState } from "react";
import { LayoutGrid, LayoutList, Pencil, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { BossFormModal, type Boss } from "@/features/admin/components/BossFormModal";
import { BossCard } from "@/features/admin/components/BossCard";

const PAGE_SIZE = 12;

export function AdminArenaScreen() {
  const [bosses, setBosses] = useState<Boss[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const { value: viewMode, setValue: setViewMode } = useLocalStorage<"table" | "grid">("admin-arena-view", "table");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingBoss, setEditingBoss] = useState<Boss | null>(null);

  const loadBosses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/arena/bosses", { credentials: "include" });
      const data = (await res.json()) as { bosses?: Boss[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Falha ao carregar bosses");
      setBosses(data.bosses ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar bosses.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBosses();
  }, [loadBosses]);

  function openCreateModal() {
    setEditingBoss(null);
    setModalOpen(true);
  }

  function openEditModal(boss: Boss) {
    setEditingBoss(boss);
    setModalOpen(true);
  }

  function handleSaved() {
    setModalOpen(false);
    setMessage(editingBoss ? "Boss atualizado." : "Boss criado com sucesso.");
    void loadBosses();
  }

  async function handleToggleActive(boss: Boss) {
    await fetch(`/api/admin/arena/bosses/${boss.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ active: !boss.active }),
    });
    void loadBosses();
  }

  async function handleDelete(bossId: string) {
    if (!confirm("Remover boss? Esta ação não pode ser desfeita.")) return;
    await fetch(`/api/admin/arena/bosses/${bossId}`, { method: "DELETE", credentials: "include" });
    void loadBosses();
  }

  const totalPages = Math.max(1, Math.ceil(bosses.length / PAGE_SIZE));
  const paginated = bosses.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <main className="space-y-5">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase text-[#f97316]">Arena</p>
        <h1 className="font-mono text-sm uppercase text-[#f8fafc]">Gerenciar Bosses</h1>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={openCreateModal}
            className="border border-[#f97316] px-3 py-1.5 font-mono text-xs uppercase text-[#f97316] hover:bg-[#f97316]/10"
          >
            + Adicionar Boss
          </button>
          <button
            type="button"
            onClick={() => void loadBosses()}
            disabled={loading}
            className="border border-[#334155] px-3 py-1 text-xs uppercase text-[#e2e8f0] disabled:opacity-50"
          >
            Atualizar
          </button>

          {/* View mode toggle */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              title="Visualizacao em tabela"
              className={`flex items-center justify-center border p-1.5 ${
                viewMode === "table" ? "border-[#f97316] text-[#f97316]" : "border-[#334155] text-[#64748b] hover:border-[#475569]"
              }`}
            >
              <LayoutList size={14} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              title="Visualizacao em grade"
              className={`flex items-center justify-center border p-1.5 ${
                viewMode === "grid" ? "border-[#f97316] text-[#f97316]" : "border-[#334155] text-[#64748b] hover:border-[#475569]"
              }`}
            >
              <LayoutGrid size={14} />
            </button>
          </div>

          {bosses.length > 0 && (
            <span className="font-mono text-xs text-[#64748b]">{bosses.length} boss(es) cadastrados</span>
          )}
        </div>
      </header>

      {message && <p className="font-mono text-xs text-[#86efac]">{message}</p>}
      {error && <p className="font-mono text-xs text-[#fca5a5]">{error}</p>}

      {loading ? (
        <p className="font-mono text-xs text-[#94a3b8]">Carregando bosses...</p>
      ) : (
        <>
          {viewMode === "grid" ? (
            paginated.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {paginated.map((boss) => (
                  <BossCard
                    key={boss.id}
                    boss={boss}
                    onEdit={openEditModal}
                    onToggleActive={(b) => void handleToggleActive(b)}
                    onDelete={(id) => void handleDelete(id)}
                  />
                ))}
              </div>
            ) : (
              <p className="border border-[#1e293b] bg-[#111827] py-8 text-center font-mono text-xs text-[#64748b]">
                Nenhum boss cadastrado.
              </p>
            )
          ) : (
            <section className="overflow-x-auto border border-[#1e293b] bg-[#111827]">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="border-b border-[#1e293b] bg-[#0f172a] text-xs uppercase text-[#94a3b8]">
                  <tr>
                    <th className="px-3 py-2">Arte</th>
                    <th className="px-3 py-2">Nome / Código</th>
                    <th className="px-3 py-2">Serviço AWS</th>
                    <th className="px-3 py-2 text-center">Max HP</th>
                    <th className="px-3 py-2 text-center">Dano/certa</th>
                    <th className="px-3 py-2 text-center">Status</th>
                    <th className="px-3 py-2">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((boss) => (
                    <tr key={boss.id} className="border-b border-[#1e293b] text-[#e2e8f0] hover:bg-white/[0.02]">
                      <td className="px-3 py-2">
                        {boss.artworkUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={boss.artworkUrl}
                            alt={boss.name}
                            className="h-10 w-10 object-cover border border-[#1e293b]"
                          />
                        ) : (
                          <span className="text-lg text-[#334155]">⚔</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <p className="text-sm">{boss.name}</p>
                        <p className="text-xs text-[#64748b]">{boss.code}</p>
                      </td>
                      <td className="px-3 py-2 text-xs text-[#94a3b8]">{boss.themeService}</td>
                      <td className="px-3 py-2 text-center font-mono text-xs">{boss.maxHp}</td>
                      <td className="px-3 py-2 text-center font-mono text-xs">{boss.damagePerCorrect}</td>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => void handleToggleActive(boss)}
                          className={`inline-flex items-center gap-1 border px-2 py-0.5 font-mono text-[10px] uppercase ${
                            boss.active
                              ? "border-[#14532d] bg-green-900/20 text-green-300"
                              : "border-[#334155] text-[#64748b]"
                          }`}
                        >
                          {boss.active ? <ToggleRight size={12} /> : <ToggleLeft size={12} />}
                          {boss.active ? "Ativo" : "Inativo"}
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(boss)}
                            className="flex items-center gap-1 border border-[#334155] px-3 py-1 font-mono text-[10px] uppercase text-[#94a3b8] hover:border-[#f97316] hover:text-[#f97316] transition-colors"
                          >
                            <Pencil size={11} />
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(boss.id)}
                            className="flex items-center gap-1 border border-red-500/40 px-3 py-1 font-mono text-[10px] uppercase text-red-400"
                          >
                            <Trash2 size={11} />
                            Remover
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {paginated.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center font-mono text-xs text-[#64748b]">
                        Nenhum boss cadastrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          )}

          {totalPages > 1 && (
            <footer className="flex items-center justify-between border border-[#1e293b] bg-[#111827] px-4 py-3 text-sm text-[#cbd5e1]">
              <span className="font-mono text-xs">
                Página {page} de {totalPages} | Total: {bosses.length}
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

      {modalOpen && <BossFormModal boss={editingBoss} onClose={() => setModalOpen(false)} onSaved={handleSaved} />}
    </main>
  );
}
