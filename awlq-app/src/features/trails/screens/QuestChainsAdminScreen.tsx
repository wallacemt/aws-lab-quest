"use client";

import { useCallback, useEffect, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Stage = {
  id: string;
  position: number;
  title: string;
  awsServiceId: string | null;
  topic: string | null;
  unlockRule: unknown;
};

type Chain = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  displayOrder: number;
  certificationPresetId: string | null;
  stages: Stage[];
  userCount: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", ...options });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

// ─── Add Stage Form ───────────────────────────────────────────────────────────

type AddStageFormProps = {
  chainId: string;
  nextPosition: number;
  onCreated: () => void;
};

function AddStageForm({ chainId, nextPosition, onCreated }: AddStageFormProps) {
  const [title, setTitle] = useState("");
  const [serviceCode, setServiceCode] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setIsSaving(true);
    try {
      await apiFetch(`/api/admin/trails/${chainId}/stages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          position: nextPosition,
          awsServiceId: serviceCode.trim() || null,
        }),
      });
      setTitle("");
      setServiceCode("");
      onCreated();
    } catch (err) {
      alert(`Erro ao criar estágio: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSaving(false);
    }
  };

  const inputClass =
    "border border-[#334155] bg-[#0b1220] px-2 py-1 font-mono text-xs text-[#e2e8f0] outline-none focus:border-[#f97316]";

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="flex gap-2 pt-2">
      <input
        type="text"
        placeholder="Título do estágio"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className={`min-w-0 flex-1 ${inputClass}`}
      />
      <input
        type="text"
        placeholder="Serviço (ex: VPC)"
        value={serviceCode}
        onChange={(e) => setServiceCode(e.target.value)}
        className={`w-32 ${inputClass}`}
      />
      <button
        type="submit"
        disabled={isSaving || !title.trim()}
        className="border border-[#334155] px-3 py-1 font-mono text-[10px] uppercase text-[#e2e8f0] hover:border-[#f97316] hover:text-[#f97316] transition-colors disabled:opacity-40"
      >
        {isSaving ? "..." : "Adicionar"}
      </button>
    </form>
  );
}

// ─── Chain Row ────────────────────────────────────────────────────────────────

type ChainRowProps = {
  chain: Chain;
  onUpdated: () => void;
};

function ChainRow({ chain, onUpdated }: ChainRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTogglingActive, setIsTogglingActive] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeletingStage, setIsDeletingStage] = useState<string | null>(null);

  const handleToggleActive = async () => {
    setIsTogglingActive(true);
    try {
      await apiFetch(`/api/admin/trails/${chain.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !chain.active }),
      });
      onUpdated();
    } catch (err) {
      alert(`Erro: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsTogglingActive(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Deletar trilha "${chain.name}"? Esta ação é irreversível.`)) return;
    setIsDeleting(true);
    try {
      await apiFetch(`/api/admin/trails/${chain.id}`, { method: "DELETE" });
      onUpdated();
    } catch (err) {
      alert(`Erro: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteStage = async (stageId: string, stageTitle: string) => {
    if (!confirm(`Deletar estágio "${stageTitle}"?`)) return;
    setIsDeletingStage(stageId);
    try {
      await apiFetch(`/api/admin/trails/${chain.id}/stages/${stageId}`, { method: "DELETE" });
      onUpdated();
    } catch (err) {
      alert(`Erro ao deletar: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsDeletingStage(null);
    }
  };

  const btnBase =
    "border border-[#334155] px-3 py-1 font-mono text-[10px] uppercase transition-colors";

  return (
    <div className="border border-[#1e293b] bg-[#111827] p-4">
      {/* Chain header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-mono text-sm font-bold text-[#e2e8f0]">{chain.name}</h3>
            <span
              className={`border px-1.5 py-0.5 font-mono text-[10px] uppercase ${
                chain.active
                  ? "border-[#14532d] bg-green-900/20 text-green-300"
                  : "border-[#334155] text-[#64748b]"
              }`}
            >
              {chain.active ? "ativa" : "inativa"}
            </span>
          </div>
          {chain.description && (
            <p className="mt-0.5 font-mono text-xs text-[#94a3b8]">{chain.description}</p>
          )}
          <p className="mt-1 font-mono text-[10px] text-[#64748b]">
            {chain.stages.length} estágio(s) · {chain.userCount} usuário(s) com progresso
          </p>
        </div>

        <div className="flex flex-shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleToggleActive()}
            disabled={isTogglingActive}
            className={`${btnBase} text-[#94a3b8] hover:border-[#f97316] hover:text-[#f97316] disabled:opacity-40`}
          >
            {isTogglingActive ? "..." : chain.active ? "Desativar" : "Ativar"}
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded((v) => !v)}
            className={`${btnBase} text-[#94a3b8] hover:border-[#f97316] hover:text-[#f97316]`}
          >
            {isExpanded ? "Fechar" : "Estágios"}
          </button>
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={isDeleting}
            className={`${btnBase} text-red-400 hover:border-red-600 disabled:opacity-40`}
          >
            {isDeleting ? "..." : "Deletar"}
          </button>
        </div>
      </div>

      {/* Inline stage editor */}
      {isExpanded && (
        <div className="mt-4 border-t border-[#1e293b] pt-4 space-y-2">
          <p className="font-mono text-xs uppercase text-[#64748b]">Estágios</p>
          {chain.stages.length === 0 && (
            <p className="font-mono text-xs text-[#64748b]">Nenhum estágio ainda.</p>
          )}
          {chain.stages.map((stage) => (
            <div
              key={stage.id}
              className="flex items-center gap-3 border border-[#1e293b] bg-[#0f172a] px-3 py-2"
            >
              <span className="w-6 flex-shrink-0 font-mono text-xs text-[#64748b]">
                {stage.position}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-xs font-bold text-[#e2e8f0]">{stage.title}</p>
                {(stage.awsServiceId ?? stage.topic) && (
                  <p className="font-mono text-[10px] text-[#64748b]">
                    {stage.awsServiceId ?? stage.topic}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => void handleDeleteStage(stage.id, stage.title)}
                disabled={isDeletingStage === stage.id}
                className="flex-shrink-0 font-mono text-[10px] text-red-400 underline hover:opacity-70 disabled:opacity-40"
              >
                {isDeletingStage === stage.id ? "..." : "Deletar"}
              </button>
            </div>
          ))}
          <AddStageForm
            chainId={chain.id}
            nextPosition={chain.stages.length + 1}
            onCreated={onUpdated}
          />
        </div>
      )}
    </div>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function QuestChainsAdminScreen() {
  const [chains, setChains] = useState<Chain[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New chain form
  const [formOpen, setFormOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [isSavingChain, setIsSavingChain] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ chains: Chain[] }>("/api/admin/trails");
      setChains(data.chains);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar trilhas.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreateChain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setIsSavingChain(true);
    try {
      await apiFetch("/api/admin/trails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDescription.trim() || undefined,
        }),
      });
      setNewName("");
      setNewDescription("");
      setFormOpen(false);
      void load();
    } catch (err) {
      alert(`Erro ao criar trilha: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSavingChain(false);
    }
  };

  const inputClass =
    "w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm text-[#e2e8f0] outline-none focus:border-[#f97316]";

  return (
    <main className="space-y-5">
      {/* Header */}
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase text-[#f97316]">Trilhas</p>
        <h1 className="font-mono text-sm uppercase text-[#f8fafc]">Trilhas de Aprendizagem</h1>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void load()}
            className="border border-[#334155] px-3 py-1 text-xs uppercase text-[#e2e8f0]"
          >
            Atualizar dados
          </button>
          <span className="font-mono text-xs text-[#64748b]">{chains.length} trilha(s)</span>
        </div>
      </header>

      {/* Nova Trilha section */}
      <section className="border border-[#1e293b] bg-[#111827] p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="font-mono text-xs uppercase text-[#f97316]">Nova Trilha</p>
          <button
            type="button"
            onClick={() => setFormOpen((v) => !v)}
            className="border border-[#334155] px-3 py-1 font-mono text-[10px] uppercase text-[#e2e8f0] hover:border-[#f97316] hover:text-[#f97316] transition-colors"
          >
            {formOpen ? "Cancelar" : "Criar Trilha"}
          </button>
        </div>

        {formOpen && (
          <form onSubmit={(e) => void handleCreateChain(e)} className="space-y-3">
            <input
              type="text"
              placeholder="Nome da trilha"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
              className={inputClass}
            />
            <input
              type="text"
              placeholder="Descrição (opcional)"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              className={inputClass}
            />
            <button
              type="submit"
              disabled={isSavingChain || !newName.trim()}
              className="border border-[#f97316] bg-[#f97316] px-4 py-2 font-mono text-xs uppercase text-[#0b1220] disabled:opacity-50 hover:opacity-90 transition-opacity"
            >
              {isSavingChain ? "Criando..." : "Criar"}
            </button>
          </form>
        )}
      </section>

      {isLoading && <p className="text-sm text-[#94a3b8]">Carregando trilhas...</p>}
      {error && <p className="text-sm text-[#fca5a5]">{error}</p>}

      {!isLoading && !error && chains.length === 0 && (
        <p className="font-mono text-sm text-[#64748b]">Nenhuma trilha criada ainda.</p>
      )}

      <div className="space-y-4">
        {chains.map((chain) => (
          <ChainRow key={chain.id} chain={chain} onUpdated={() => void load()} />
        ))}
      </div>
    </main>
  );
}
