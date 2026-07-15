"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AchievementFormModal,
  TRIGGER_TYPE_LABELS,
  type Achievement,
} from "@/features/admin/components/AchievementFormModal";

const RARITIES = ["common", "uncommon", "rare", "epic", "legendary"];
const PAGE_SIZE = 10;

export function AdminGamificationScreen() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("all");
  const [filterRarity, setFilterRarity] = useState<string>("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingAchievement, setEditingAchievement] = useState<Achievement | null>(null);

  const loadAchievements = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/achievements", { credentials: "include" });
      const data = (await res.json()) as { achievements?: Achievement[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Falha ao carregar conquistas");
      setAchievements(data.achievements ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar conquistas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAchievements();
  }, [loadAchievements]);

  function openCreateModal() {
    setEditingAchievement(null);
    setModalOpen(true);
  }

  function openEditModal(achievement: Achievement) {
    setEditingAchievement(achievement);
    setModalOpen(true);
  }

  function handleSaved() {
    setModalOpen(false);
    setMessage(editingAchievement ? "Conquista atualizada." : "Conquista criada com sucesso.");
    void loadAchievements();
  }

  async function handleToggleActive(achievement: Achievement) {
    await fetch(`/api/admin/achievements/${achievement.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ active: !achievement.active }),
    });
    void loadAchievements();
  }

  async function handleDeactivate(achievementId: string) {
    if (
      !confirm(
        "Desativar conquista? Usuarios que ja desbloquearam mantem o progresso, mas ela some do catalogo ativo.",
      )
    )
      return;
    await fetch(`/api/admin/achievements/${achievementId}`, { method: "DELETE", credentials: "include" });
    void loadAchievements();
  }

  const filtered = achievements.filter((achievement) => {
    if (filterActive === "active" && !achievement.active) return false;
    if (filterActive === "inactive" && achievement.active) return false;
    if (filterRarity !== "all" && achievement.rarity !== filterRarity) return false;
    return true;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <main className="space-y-5">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase text-[#f97316]">Gamificacao</p>
        <h1 className="font-mono text-sm uppercase text-[#f8fafc]">Gerenciar Conquistas</h1>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={openCreateModal}
            className="border border-[#f97316] px-3 py-1.5 font-mono text-xs uppercase text-[#f97316] hover:bg-[#f97316]/10"
          >
            + Adicionar Conquista
          </button>
          <button
            type="button"
            onClick={() => void loadAchievements()}
            disabled={loading}
            className="border border-[#334155] px-3 py-1 text-xs uppercase text-[#e2e8f0] disabled:opacity-50"
          >
            Atualizar
          </button>
          {achievements.length > 0 && (
            <span className="font-mono text-xs text-[#64748b]">{achievements.length} conquista(s) cadastradas</span>
          )}
        </div>
      </header>

      {message && <p className="font-mono text-xs text-[#86efac]">{message}</p>}
      {error && <p className="font-mono text-xs text-[#fca5a5]">{error}</p>}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          className="border border-[#334155] bg-[#0b1220] px-3 py-1.5 font-mono text-xs text-[#e2e8f0]"
          value={filterActive}
          onChange={(e) => {
            setFilterActive(e.target.value as typeof filterActive);
            setPage(1);
          }}
        >
          <option value="all">Todas</option>
          <option value="active">Ativas</option>
          <option value="inactive">Inativas</option>
        </select>
        <select
          className="border border-[#334155] bg-[#0b1220] px-3 py-1.5 font-mono text-xs text-[#e2e8f0]"
          value={filterRarity}
          onChange={(e) => {
            setFilterRarity(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">Todas raridades</option>
          {RARITIES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      {/* List */}
      {loading ? (
        <p className="font-mono text-xs text-[#94a3b8]">Carregando conquistas...</p>
      ) : (
        <>
          <section className="overflow-x-auto border border-[#1e293b] bg-[#111827]">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-[#1e293b] bg-[#0f172a] text-xs uppercase text-[#94a3b8]">
                <tr>
                  <th className="px-3 py-2">Badge</th>
                  <th className="px-3 py-2">Nome / Codigo</th>
                  <th className="px-3 py-2">Gatilho</th>
                  <th className="px-3 py-2 text-center">Target</th>
                  <th className="px-3 py-2 text-center">Raridade</th>
                  <th className="px-3 py-2 text-center">Status</th>
                  <th className="px-3 py-2">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((achievement) => (
                  <tr key={achievement.id} className="border-b border-[#1e293b] text-[#e2e8f0] hover:bg-white/[0.02]">
                    <td className="px-3 py-2">
                      {achievement.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={achievement.imageUrl}
                          alt={achievement.name}
                          className="h-10 w-10 object-cover border border-[#1e293b]"
                        />
                      ) : (
                        <span className="text-lg text-[#334155]">🏅</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <p className="text-sm">{achievement.name}</p>
                      <p className="text-xs text-[#64748b]">{achievement.code}</p>
                    </td>
                    <td className="px-3 py-2 text-xs text-[#94a3b8]">{TRIGGER_TYPE_LABELS[achievement.triggerType]}</td>
                    <td className="px-3 py-2 text-center font-mono text-xs">{achievement.target}</td>
                    <td className="px-3 py-2 text-center font-mono text-xs">{achievement.rarity}</td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => void handleToggleActive(achievement)}
                        className={`border px-2 py-0.5 font-mono text-[10px] uppercase ${
                          achievement.active
                            ? "border-[#14532d] bg-green-900/20 text-green-300"
                            : "border-[#334155] text-[#64748b]"
                        }`}
                      >
                        {achievement.active ? "Ativa" : "Inativa"}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(achievement)}
                          className="border border-[#334155] px-3 py-1 font-mono text-[10px] uppercase text-[#94a3b8] hover:border-[#f97316] hover:text-[#f97316] transition-colors"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeactivate(achievement.id)}
                          className="border border-red-500/40 px-3 py-1 font-mono text-[10px] uppercase text-red-400"
                        >
                          Desativar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {paginated.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center font-mono text-xs text-[#64748b]">
                      Nenhuma conquista encontrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          {totalPages > 1 && (
            <footer className="flex items-center justify-between border border-[#1e293b] bg-[#111827] px-4 py-3 text-sm text-[#cbd5e1]">
              <span className="font-mono text-xs">
                Pagina {page} de {totalPages} | Total: {filtered.length}
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
                  Proxima
                </button>
              </div>
            </footer>
          )}
        </>
      )}

      {modalOpen && (
        <AchievementFormModal
          achievement={editingAchievement}
          onClose={() => setModalOpen(false)}
          onSaved={handleSaved}
        />
      )}
    </main>
  );
}
