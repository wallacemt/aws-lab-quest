"use client";

import { useCallback, useEffect, useState } from "react";
import { LayoutGrid, LayoutList, Pencil, Trash2 } from "lucide-react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { ChainFormModal, type Chain as ChainFormChain } from "@/features/trails/components/ChainFormModal";
import { StageFormModal, type Stage } from "@/features/trails/components/StageFormModal";
import { TrailChainCard } from "@/features/trails/components/TrailChainCard";

type Chain = ChainFormChain & {
  stages: Stage[];
  userCount: number;
  certificationPreset: { code: string; name: string } | null;
};

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", ...options });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export function QuestChainsAdminScreen() {
  const [chains, setChains] = useState<Chain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const { value: viewMode, setValue: setViewMode } = useLocalStorage<"table" | "grid">("admin-trilhas-view", "table");

  const [chainModalOpen, setChainModalOpen] = useState(false);
  const [editingChain, setEditingChain] = useState<Chain | null>(null);

  const [stageModalOpen, setStageModalOpen] = useState(false);
  const [stageModalChainId, setStageModalChainId] = useState<string | null>(null);
  const [editingStage, setEditingStage] = useState<Stage | null>(null);
  const [stageModalNextPosition, setStageModalNextPosition] = useState(1);

  const [managingChainId, setManagingChainId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ chains: Chain[] }>("/api/admin/trails");
      setChains(data.chains);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar trilhas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreateChain() {
    setEditingChain(null);
    setChainModalOpen(true);
  }

  function openEditChain(chain: Chain) {
    setEditingChain(chain);
    setChainModalOpen(true);
  }

  function handleChainSaved() {
    setChainModalOpen(false);
    setMessage(editingChain ? "Trilha atualizada." : "Trilha criada com sucesso.");
    void load();
  }

  async function handleToggleActive(chain: Chain) {
    try {
      await apiFetch(`/api/admin/trails/${chain.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !chain.active }),
      });
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar trilha.");
    }
  }

  async function handleDeleteChain(chain: Chain) {
    if (!confirm(`Deletar trilha "${chain.name}"? Esta acao e irreversivel.`)) return;
    try {
      await apiFetch(`/api/admin/trails/${chain.id}`, { method: "DELETE" });
      if (managingChainId === chain.id) setManagingChainId(null);
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao deletar trilha.");
    }
  }

  function toggleManageStages(chainId: string) {
    setManagingChainId((current) => (current === chainId ? null : chainId));
  }

  function openCreateStage(chainId: string, nextPosition: number) {
    setStageModalChainId(chainId);
    setEditingStage(null);
    setStageModalNextPosition(nextPosition);
    setStageModalOpen(true);
  }

  function openEditStage(chainId: string, stage: Stage) {
    setStageModalChainId(chainId);
    setEditingStage(stage);
    setStageModalOpen(true);
  }

  function handleStageSaved() {
    setStageModalOpen(false);
    setMessage(editingStage ? "Estagio atualizado." : "Estagio criado com sucesso.");
    void load();
  }

  async function handleDeleteStage(chainId: string, stage: Stage) {
    if (!confirm(`Deletar estagio "${stage.title}"?`)) return;
    try {
      await apiFetch(`/api/admin/trails/${chainId}/stages/${stage.id}`, { method: "DELETE" });
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao deletar estagio.");
    }
  }

  const managingChain = chains.find((c) => c.id === managingChainId) ?? null;

  return (
    <main className="space-y-5">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase text-[#f97316]">Trilhas</p>
        <h1 className="font-mono text-sm uppercase text-[#f8fafc]">Trilhas de Aprendizagem</h1>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={openCreateChain}
            className="border border-[#f97316] px-3 py-1.5 font-mono text-xs uppercase text-[#f97316] hover:bg-[#f97316]/10"
          >
            + Adicionar Trilha
          </button>
          <button
            type="button"
            onClick={() => void load()}
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

          {chains.length > 0 && <span className="font-mono text-xs text-[#64748b]">{chains.length} trilha(s)</span>}
        </div>
      </header>

      {message && <p className="font-mono text-xs text-[#86efac]">{message}</p>}
      {error && <p className="font-mono text-xs text-[#fca5a5]">{error}</p>}

      {loading ? (
        <p className="font-mono text-xs text-[#94a3b8]">Carregando trilhas...</p>
      ) : chains.length === 0 ? (
        <p className="border border-[#1e293b] bg-[#111827] py-8 text-center font-mono text-xs text-[#64748b]">
          Nenhuma trilha criada ainda.
        </p>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {chains.map((chain) => (
            <TrailChainCard
              key={chain.id}
              chain={{
                id: chain.id,
                name: chain.name,
                description: chain.description,
                active: chain.active,
                stageCount: chain.stages.length,
                userCount: chain.userCount,
                certificationCode: chain.certificationPreset?.code ?? null,
              }}
              onEdit={() => openEditChain(chain)}
              onManageStages={() => toggleManageStages(chain.id)}
              onToggleActive={() => void handleToggleActive(chain)}
              onDelete={() => void handleDeleteChain(chain)}
            />
          ))}
        </div>
      ) : (
        <section className="overflow-x-auto border border-[#1e293b] bg-[#111827]">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="border-b border-[#1e293b] bg-[#0f172a] text-xs uppercase text-[#94a3b8]">
              <tr>
                <th className="px-3 py-2">Nome</th>
                <th className="px-3 py-2">Certificacao</th>
                <th className="px-3 py-2 text-center">Estagios</th>
                <th className="px-3 py-2 text-center">Usuarios</th>
                <th className="px-3 py-2 text-center">Status</th>
                <th className="px-3 py-2">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {chains.map((chain) => (
                <tr key={chain.id} className="border-b border-[#1e293b] text-[#e2e8f0] hover:bg-white/[0.02]">
                  <td className="px-3 py-2">
                    <p className="text-sm">{chain.name}</p>
                    {chain.description && <p className="text-xs text-[#64748b] line-clamp-1">{chain.description}</p>}
                  </td>
                  <td className="px-3 py-2 text-xs text-[#94a3b8]">{chain.certificationPreset?.code ?? "—"}</td>
                  <td className="px-3 py-2 text-center font-mono text-xs">{chain.stages.length}</td>
                  <td className="px-3 py-2 text-center font-mono text-xs">{chain.userCount}</td>
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => void handleToggleActive(chain)}
                      className={`border px-2 py-0.5 font-mono text-[10px] uppercase ${
                        chain.active
                          ? "border-[#14532d] bg-green-900/20 text-green-300"
                          : "border-[#334155] text-[#64748b]"
                      }`}
                    >
                      {chain.active ? "Ativa" : "Inativa"}
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => toggleManageStages(chain.id)}
                        className={`border px-3 py-1 font-mono text-[10px] uppercase transition-colors ${
                          managingChainId === chain.id
                            ? "border-[#38bdf8] text-[#38bdf8]"
                            : "border-[#334155] text-[#94a3b8] hover:border-[#38bdf8] hover:text-[#38bdf8]"
                        }`}
                      >
                        Estagios
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditChain(chain)}
                        className="flex items-center gap-1 border border-[#334155] px-3 py-1 font-mono text-[10px] uppercase text-[#94a3b8] hover:border-[#f97316] hover:text-[#f97316]"
                      >
                        <Pencil size={11} />
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteChain(chain)}
                        className="flex items-center gap-1 border border-red-500/40 px-3 py-1 font-mono text-[10px] uppercase text-red-400"
                      >
                        <Trash2 size={11} />
                        Deletar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Stage management panel for the selected chain */}
      {managingChain && (
        <section className="space-y-3 border border-[#1e3a5f] bg-[#0b1220] p-4">
          <div className="flex items-center justify-between">
            <p className="font-mono text-xs uppercase text-[#38bdf8]">Estagios — {managingChain.name}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => openCreateStage(managingChain.id, managingChain.stages.length + 1)}
                className="border border-[#1e3a5f] bg-[#0f172a] px-3 py-1 font-mono text-[10px] uppercase text-[#38bdf8] hover:bg-[#1e3a5f]/30"
              >
                + Adicionar Estagio
              </button>
              <button
                type="button"
                onClick={() => setManagingChainId(null)}
                className="border border-[#334155] px-3 py-1 font-mono text-[10px] uppercase text-[#64748b]"
              >
                Fechar
              </button>
            </div>
          </div>

          {managingChain.stages.length === 0 && (
            <p className="font-mono text-xs text-[#64748b]">Nenhum estagio ainda.</p>
          )}

          <div className="space-y-2">
            {managingChain.stages.map((stage) => (
              <div
                key={stage.id}
                className="flex items-center gap-3 border border-[#1e293b] bg-[#111827] px-3 py-2"
              >
                <span className="w-6 flex-shrink-0 font-mono text-xs text-[#64748b]">{stage.position}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-xs font-bold text-[#e2e8f0]">{stage.title}</p>
                  <div className="flex flex-wrap gap-1.5 mt-0.5">
                    {(stage.awsServiceId ?? stage.topic) && (
                      <span className="font-mono text-[10px] text-[#64748b]">{stage.awsServiceId ?? stage.topic}</span>
                    )}
                    {stage.unlockRule && (
                      <span className="border border-[#334155] px-1 py-0.5 font-mono text-[9px] uppercase text-[#f97316]">
                        {stage.unlockRule.sessionType} ≥ {stage.unlockRule.minScorePercent}%
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openEditStage(managingChain.id, stage)}
                  className="flex-shrink-0 font-mono text-[10px] text-[#38bdf8] underline hover:opacity-70"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => void handleDeleteStage(managingChain.id, stage)}
                  className="flex-shrink-0 font-mono text-[10px] text-red-400 underline hover:opacity-70"
                >
                  Deletar
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {chainModalOpen && (
        <ChainFormModal
          chain={editingChain}
          onClose={() => setChainModalOpen(false)}
          onSaved={handleChainSaved}
        />
      )}

      {stageModalOpen && stageModalChainId && (
        <StageFormModal
          chainId={stageModalChainId}
          stage={editingStage}
          nextPosition={stageModalNextPosition}
          onClose={() => setStageModalOpen(false)}
          onSaved={handleStageSaved}
        />
      )}
    </main>
  );
}
