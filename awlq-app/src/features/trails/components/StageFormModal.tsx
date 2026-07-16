"use client";

import { useEffect, useState } from "react";
import { ServiceMultiSelect, type ServiceOption } from "@/features/admin/components/ServiceMultiSelect";

export type UnlockRule = {
  minScorePercent?: number;
  sessionType?: "KC" | "SIMULADO";
};

export type Stage = {
  id: string;
  position: number;
  title: string;
  awsServiceId: string | null;
  topic: string | null;
  unlockRule: UnlockRule | null;
};

type FormState = {
  title: string;
  position: number;
  awsServiceId: string;
  topic: string;
  requireUnlockRule: boolean;
  unlockSessionType: "KC" | "SIMULADO";
  unlockMinScorePercent: number;
};

function emptyForm(nextPosition: number): FormState {
  return {
    title: "",
    position: nextPosition,
    awsServiceId: "",
    topic: "",
    requireUnlockRule: false,
    unlockSessionType: "KC",
    unlockMinScorePercent: 70,
  };
}

type Props = {
  chainId: string;
  /** null = create mode. A stage object = edit mode, prefilled. */
  stage: Stage | null;
  /** Position to default to when creating a new stage (ignored in edit mode). */
  nextPosition: number;
  onClose: () => void;
  onSaved: () => void;
};

export function StageFormModal({ chainId, stage, nextPosition, onClose, onSaved }: Props) {
  const isEdit = stage !== null;
  const [form, setForm] = useState<FormState>(emptyForm(nextPosition));
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/study/services", { credentials: "include" })
      .then((res) => res.json())
      .then((json: { services?: ServiceOption[] }) => setServices(json.services ?? []))
      .catch(() => {
        // ServiceMultiSelect just shows an empty list when this fails.
      });
  }, []);

  useEffect(() => {
    if (stage) {
      setForm({
        title: stage.title,
        position: stage.position,
        awsServiceId: stage.awsServiceId ?? "",
        topic: stage.topic ?? "",
        requireUnlockRule: stage.unlockRule !== null,
        unlockSessionType: stage.unlockRule?.sessionType ?? "KC",
        unlockMinScorePercent: stage.unlockRule?.minScorePercent ?? 70,
      });
    } else {
      setForm(emptyForm(nextPosition));
    }
    setError(null);
  }, [stage, nextPosition]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const url = isEdit
        ? `/api/admin/trails/${chainId}/stages/${stage.id}`
        : `/api/admin/trails/${chainId}/stages`;
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: form.title,
          position: form.position,
          awsServiceId: form.awsServiceId || null,
          topic: form.topic.trim() || null,
          unlockRule: form.requireUnlockRule
            ? { sessionType: form.unlockSessionType, minScorePercent: form.unlockMinScorePercent }
            : null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar estagio");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar estagio.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/75 p-4" role="dialog" aria-modal="true">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col rounded border border-[#334155] bg-[#111827] text-[#e2e8f0]">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[#1e293b] px-6 py-4">
          <div>
            <p className="font-mono text-[10px] uppercase text-[#f97316]">{isEdit ? "Editar estagio" : "Novo estagio"}</p>
            <h2 className="mt-1 text-base font-semibold text-[#f8fafc]">{isEdit ? stage.title : "Criar estagio"}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="border border-[#334155] px-3 py-1 text-xs uppercase text-[#94a3b8] hover:text-[#e2e8f0]"
          >
            Fechar
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {error && (
            <p className="border border-[#7f1d1d] bg-red-900/20 px-3 py-2 text-xs text-[#fca5a5]">{error}</p>
          )}

          <section className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <label className="block space-y-1">
                <span className="text-xs uppercase text-[#64748b]">Titulo</span>
                <input
                  className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm placeholder:text-[#475569]"
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs uppercase text-[#64748b]">Posicao</span>
                <input
                  type="number"
                  min={1}
                  className="w-24 border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm"
                  value={form.position}
                  onChange={(e) => setForm((p) => ({ ...p, position: Number(e.target.value) }))}
                />
              </label>
            </div>

            <label className="block space-y-1">
              <span className="text-xs uppercase text-[#64748b]">Topico livre (alternativa ao servico AWS)</span>
              <input
                className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm placeholder:text-[#475569]"
                placeholder="ex: Fundamentos de Custos"
                value={form.topic}
                onChange={(e) => setForm((p) => ({ ...p, topic: e.target.value }))}
              />
            </label>

            <div className="space-y-1">
              <span className="text-xs uppercase text-[#64748b]">Servico AWS (opcional)</span>
              <ServiceMultiSelect
                allServices={services}
                selectedCodes={form.awsServiceId ? [form.awsServiceId] : []}
                onChange={(codes) => setForm((p) => ({ ...p, awsServiceId: codes[0] ?? "" }))}
                single
              />
            </div>
          </section>

          <section className="space-y-3 border-t border-[#1e293b] pt-5">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.requireUnlockRule}
                onChange={(e) => setForm((p) => ({ ...p, requireUnlockRule: e.target.checked }))}
                className="accent-[#f97316]"
              />
              <span className="text-xs uppercase text-[#64748b]">Exigir desempenho minimo para desbloquear</span>
            </label>
            <p className="font-mono text-[10px] text-[#64748b]">
              Sem essa regra, o estagio desbloqueia assim que o anterior for concluido.
            </p>

            {form.requireUnlockRule && (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1">
                  <span className="text-xs uppercase text-[#64748b]">Tipo de sessao</span>
                  <select
                    className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm"
                    value={form.unlockSessionType}
                    onChange={(e) => setForm((p) => ({ ...p, unlockSessionType: e.target.value as "KC" | "SIMULADO" }))}
                  >
                    <option value="KC">KC</option>
                    <option value="SIMULADO">SIMULADO</option>
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-xs uppercase text-[#64748b]">Nota minima (%)</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm"
                    value={form.unlockMinScorePercent}
                    onChange={(e) => setForm((p) => ({ ...p, unlockMinScorePercent: Number(e.target.value) }))}
                  />
                </label>
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-[#1e293b] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="border border-[#334155] px-4 py-2 text-xs uppercase text-[#94a3b8] hover:text-[#e2e8f0]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !form.title || !form.position}
            className="border border-[#1d4ed8] bg-blue-900/20 px-4 py-2 text-xs uppercase text-blue-300 disabled:opacity-40"
          >
            {saving ? "Salvando..." : isEdit ? "Salvar alteracoes" : "Criar estagio"}
          </button>
        </div>
      </div>
    </div>
  );
}
