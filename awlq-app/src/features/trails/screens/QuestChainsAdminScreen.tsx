"use client";

import { useCallback, useEffect, useState } from "react";
import { PixelCard } from "@/components/ui/pixel-card";
import { PixelButton } from "@/components/ui/pixel-button";

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
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

// ─── Stage editor row ─────────────────────────────────────────────────────────

type StageRowProps = {
  stage: Stage;
  chainId: string;
  onDeleted: () => void;
};

function StageRow({ stage, chainId, onDeleted }: StageRowProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`Deletar estágio "${stage.title}"?`)) return;
    setIsDeleting(true);
    try {
      await apiFetch(`/api/admin/trails/${chainId}/stages/${stage.id}`, { method: "DELETE" });
      onDeleted();
    } catch (err) {
      alert(`Erro ao deletar: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex items-center gap-3 rounded border border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2">
      <span className="w-6 flex-shrink-0 font-mono text-xs text-[var(--pixel-muted)]">
        {stage.position}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-xs font-bold text-[var(--pixel-text)]">{stage.title}</p>
        {(stage.awsServiceId || stage.topic) && (
          <p className="font-mono text-[10px] text-[var(--pixel-muted)]">
            {stage.awsServiceId ?? stage.topic}
          </p>
        )}
      </div>
      <PixelButton
        variant="ghost"
        className="flex-shrink-0 text-xs text-red-500"
        onClick={() => void handleDelete()}
        disabled={isDeleting}
      >
        {isDeleting ? "..." : "Deletar"}
      </PixelButton>
    </div>
  );
}

// ─── Add stage form ───────────────────────────────────────────────────────────

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

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="flex gap-2">
      <input
        type="text"
        placeholder="Título do estágio"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="min-w-0 flex-1 rounded border border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-2 py-1 font-mono text-xs text-[var(--pixel-text)] placeholder-[var(--pixel-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--pixel-accent)]"
      />
      <input
        type="text"
        placeholder="Serviço (ex: vpc)"
        value={serviceCode}
        onChange={(e) => setServiceCode(e.target.value)}
        className="w-32 rounded border border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-2 py-1 font-mono text-xs text-[var(--pixel-text)] placeholder-[var(--pixel-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--pixel-accent)]"
      />
      <PixelButton type="submit" className="text-xs" disabled={isSaving || !title.trim()}>
        {isSaving ? "..." : "Adicionar"}
      </PixelButton>
    </form>
  );
}

// ─── Chain card ───────────────────────────────────────────────────────────────

type ChainCardProps = {
  chain: Chain;
  onUpdated: () => void;
};

function ChainCard({ chain, onUpdated }: ChainCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTogglingActive, setIsTogglingActive] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  return (
    <PixelCard className="p-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-mono text-sm font-bold text-[var(--pixel-text)]">{chain.name}</h3>
            <span
              className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
                chain.active
                  ? "bg-green-500/10 text-green-400"
                  : "bg-[var(--pixel-border)] text-[var(--pixel-muted)]"
              }`}
            >
              {chain.active ? "ativa" : "inativa"}
            </span>
          </div>
          {chain.description && (
            <p className="mt-0.5 font-mono text-xs text-[var(--pixel-muted)]">{chain.description}</p>
          )}
          <p className="mt-1 font-mono text-[10px] text-[var(--pixel-muted)]">
            {chain.stages.length} estágio(s) · {chain.userCount} usuário(s) com progresso
          </p>
        </div>

        <div className="flex flex-shrink-0 gap-2">
          <PixelButton
            variant="ghost"
            className="text-xs"
            onClick={() => void handleToggleActive()}
            disabled={isTogglingActive}
          >
            {isTogglingActive ? "..." : chain.active ? "Desativar" : "Ativar"}
          </PixelButton>
          <PixelButton
            variant="ghost"
            className="text-xs"
            onClick={() => setIsExpanded((v) => !v)}
          >
            {isExpanded ? "Fechar" : "Estágios"}
          </PixelButton>
          <PixelButton
            variant="ghost"
            className="text-xs text-red-500"
            onClick={() => void handleDelete()}
            disabled={isDeleting}
          >
            {isDeleting ? "..." : "Deletar"}
          </PixelButton>
        </div>
      </div>

      {/* Stage editor */}
      {isExpanded && (
        <div className="mt-4 space-y-3 border-t border-[var(--pixel-border)] pt-4">
          <p className="font-mono text-xs text-[var(--pixel-muted)]">Estágios</p>
          {chain.stages.length > 0 ? (
            <div className="space-y-2">
              {chain.stages.map((stage) => (
                <StageRow key={stage.id} stage={stage} chainId={chain.id} onDeleted={onUpdated} />
              ))}
            </div>
          ) : (
            <p className="font-mono text-xs text-[var(--pixel-muted)]">Nenhum estágio ainda.</p>
          )}
          <AddStageForm
            chainId={chain.id}
            nextPosition={chain.stages.length + 1}
            onCreated={onUpdated}
          />
        </div>
      )}
    </PixelCard>
  );
}

// ─── New chain form ───────────────────────────────────────────────────────────

type NewChainFormProps = {
  onCreated: () => void;
};

function NewChainForm({ onCreated }: NewChainFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSaving(true);
    try {
      await apiFetch("/api/admin/trails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined }),
      });
      setName("");
      setDescription("");
      setIsOpen(false);
      onCreated();
    } catch (err) {
      alert(`Erro ao criar trilha: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) {
    return (
      <PixelButton onClick={() => setIsOpen(true)}>Nova Trilha</PixelButton>
    );
  }

  return (
    <PixelCard className="p-4">
      <p className="mb-3 font-mono text-xs font-bold text-[var(--pixel-text)]">Nova Trilha</p>
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
        <input
          type="text"
          placeholder="Nome da trilha"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded border border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2 font-mono text-xs text-[var(--pixel-text)] placeholder-[var(--pixel-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--pixel-accent)]"
        />
        <input
          type="text"
          placeholder="Descrição (opcional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded border border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2 font-mono text-xs text-[var(--pixel-text)] placeholder-[var(--pixel-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--pixel-accent)]"
        />
        <div className="flex gap-2">
          <PixelButton type="submit" disabled={isSaving || !name.trim()}>
            {isSaving ? "Salvando..." : "Criar"}
          </PixelButton>
          <PixelButton
            type="button"
            variant="ghost"
            onClick={() => setIsOpen(false)}
          >
            Cancelar
          </PixelButton>
        </div>
      </form>
    </PixelCard>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

/**
 * Admin page for authoring Quest Chains.
 * Lists all chains with their stage editors, active toggles, and a "Nova Trilha" form.
 */
export function QuestChainsAdminScreen() {
  const [chains, setChains] = useState<Chain[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="font-mono text-sm uppercase tracking-wide text-[var(--pixel-text)]">
          Trilhas de Aprendizagem
        </h1>
        <NewChainForm onCreated={() => void load()} />
      </div>

      {isLoading && (
        <p className="font-mono text-sm text-[var(--pixel-muted)]">Carregando...</p>
      )}

      {error && (
        <p className="font-mono text-sm text-red-500">{error}</p>
      )}

      {!isLoading && chains.length === 0 && (
        <p className="font-mono text-sm text-[var(--pixel-muted)]">
          Nenhuma trilha criada ainda.
        </p>
      )}

      <div className="space-y-4">
        {chains.map((chain) => (
          <ChainCard key={chain.id} chain={chain} onUpdated={() => void load()} />
        ))}
      </div>
    </div>
  );
}
