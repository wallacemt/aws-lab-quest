"use client";

import { useEffect, useState } from "react";
import { AiSuggestionPanel } from "@/features/admin/components/AiSuggestionPanel";
import { ServiceMultiSelect, type ServiceOption } from "@/features/admin/components/ServiceMultiSelect";
import type { CertificationOption } from "@/features/admin/types";
import type { TrailSuggestion, TrailStageSuggestion } from "@/app/api/admin/trails/suggest/route";

export type Chain = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  displayOrder: number;
  certificationPresetId: string | null;
};

type StageDraft = {
  title: string;
  topic: string;
  awsServiceId: string;
  requireUnlockRule: boolean;
  unlockSessionType: "KC" | "SIMULADO";
  unlockMinScorePercent: number;
};

function emptyStageDraft(): StageDraft {
  return {
    title: "",
    topic: "",
    awsServiceId: "",
    requireUnlockRule: false,
    unlockSessionType: "KC",
    unlockMinScorePercent: 70,
  };
}

function stageDraftFromSuggestion(suggestion: TrailStageSuggestion): StageDraft {
  return {
    title: suggestion.title,
    topic: suggestion.topic ?? "",
    awsServiceId: suggestion.awsServiceId ?? "",
    requireUnlockRule: suggestion.unlockRule !== null,
    unlockSessionType: suggestion.unlockRule?.sessionType ?? "KC",
    unlockMinScorePercent: suggestion.unlockRule?.minScorePercent ?? 70,
  };
}

type FormState = {
  name: string;
  description: string;
  certificationPresetId: string;
  active: boolean;
  displayOrder: number;
  stages: StageDraft[];
};

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  certificationPresetId: "",
  active: true,
  displayOrder: 0,
  stages: [],
};

type Props = {
  /** null = create mode. A chain object = edit mode, prefilled. */
  chain: Chain | null;
  onClose: () => void;
  onSaved: () => void;
};

export function ChainFormModal({ chain, onClose, onSaved }: Props) {
  const isEdit = chain !== null;
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [certifications, setCertifications] = useState<CertificationOption[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/certifications", { credentials: "include" })
      .then((res) => res.json())
      .then((json: { certifications?: CertificationOption[] }) => setCertifications(json.certifications ?? []))
      .catch(() => {
        // The select just shows "Nenhuma" only when this fails.
      });
  }, []);

  useEffect(() => {
    if (isEdit) return;
    fetch("/api/study/services", { credentials: "include" })
      .then((res) => res.json())
      .then((json: { services?: ServiceOption[] }) => setServices(json.services ?? []))
      .catch(() => {
        // ServiceMultiSelect just shows an empty list when this fails.
      });
  }, [isEdit]);

  useEffect(() => {
    if (chain) {
      setForm({
        name: chain.name,
        description: chain.description ?? "",
        certificationPresetId: chain.certificationPresetId ?? "",
        active: chain.active,
        displayOrder: chain.displayOrder,
        stages: [],
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setError(null);
  }, [chain]);

  function applySuggestion(suggestion: TrailSuggestion) {
    setForm((p) => ({
      ...p,
      name: suggestion.name,
      description: suggestion.description,
      certificationPresetId: suggestion.certificationPresetId ?? "",
      stages: suggestion.stages.map(stageDraftFromSuggestion),
    }));
  }

  function addStageDraft() {
    setForm((p) => ({ ...p, stages: [...p.stages, emptyStageDraft()] }));
  }

  function updateStageDraft(index: number, patch: Partial<StageDraft>) {
    setForm((p) => ({
      ...p,
      stages: p.stages.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    }));
  }

  function removeStageDraft(index: number) {
    setForm((p) => ({ ...p, stages: p.stages.filter((_, i) => i !== index) }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(isEdit ? `/api/admin/trails/${chain.id}` : "/api/admin/trails", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: form.name,
          description: form.description.trim() || undefined,
          certificationPresetId: form.certificationPresetId || null,
          active: form.active,
          displayOrder: form.displayOrder,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { chain?: { id: string }; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar trilha");

      if (!isEdit && data.chain) {
        const chainId = data.chain.id;
        for (const [index, stage] of form.stages.entries()) {
          if (!stage.title.trim()) continue;
          const stageRes = await fetch(`/api/admin/trails/${chainId}/stages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              title: stage.title.trim(),
              position: index + 1,
              awsServiceId: stage.awsServiceId || null,
              topic: stage.topic.trim() || null,
              unlockRule: stage.requireUnlockRule
                ? { sessionType: stage.unlockSessionType, minScorePercent: stage.unlockMinScorePercent }
                : null,
            }),
          });
          if (!stageRes.ok) {
            const stageData = (await stageRes.json().catch(() => ({}))) as { error?: string };
            throw new Error(stageData.error ?? `Erro ao criar estagio "${stage.title}"`);
          }
        }
      }

      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar trilha.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4" role="dialog" aria-modal="true">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col rounded border border-[#334155] bg-[#111827] text-[#e2e8f0]">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[#1e293b] px-6 py-4">
          <div>
            <p className="font-mono text-[10px] uppercase text-[#f97316]">{isEdit ? "Editar trilha" : "Nova trilha"}</p>
            <h2 className="mt-1 text-base font-semibold text-[#f8fafc]">{isEdit ? chain.name : "Criar trilha"}</h2>
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

          {!isEdit && (
            <AiSuggestionPanel<TrailSuggestion>
              endpoint="/api/admin/trails/suggest"
              renderSuggestion={(suggestion) => ({
                title: suggestion.name,
                subtitle: `${suggestion.description} (${suggestion.stages.length} estagio(s))`,
              })}
              onApply={applySuggestion}
            />
          )}

          <section className="space-y-3">
            <label className="block space-y-1">
              <span className="text-xs uppercase text-[#64748b]">Nome</span>
              <input
                className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm placeholder:text-[#475569]"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs uppercase text-[#64748b]">Descricao</span>
              <textarea
                rows={2}
                className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm placeholder:text-[#475569]"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-xs uppercase text-[#64748b]">Certificacao</span>
                <select
                  className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm"
                  value={form.certificationPresetId}
                  onChange={(e) => setForm((p) => ({ ...p, certificationPresetId: e.target.value }))}
                >
                  <option value="">Nenhuma (todas)</option>
                  {certifications.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-xs uppercase text-[#64748b]">Ordem de exibicao</span>
                <input
                  type="number"
                  className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm"
                  value={form.displayOrder}
                  onChange={(e) => setForm((p) => ({ ...p, displayOrder: Number(e.target.value) }))}
                />
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="chain-active"
                checked={form.active}
                onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))}
                className="accent-[#f97316]"
              />
              <label htmlFor="chain-active" className="text-xs uppercase text-[#64748b]">
                Ativa
              </label>
            </div>
          </section>

          {!isEdit && (
            <section className="space-y-3 border-t border-[#1e293b] pt-4">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase text-[#64748b]">Estagios ({form.stages.length})</span>
                <button
                  type="button"
                  onClick={addStageDraft}
                  className="border border-[#1e3a5f] bg-[#0f172a] px-3 py-1 font-mono text-[10px] uppercase text-[#38bdf8] hover:bg-[#1e3a5f]/30"
                >
                  + Adicionar estagio
                </button>
              </div>

              {form.stages.length === 0 && (
                <p className="font-mono text-[10px] text-[#64748b]">
                  Nenhum estagio ainda. Adicione manualmente ou use a sugestao via IA acima.
                </p>
              )}

              {form.stages.map((stage, index) => (
                <div key={index} className="space-y-2 border border-[#1e293b] bg-[#0b1220] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="w-6 flex-shrink-0 font-mono text-xs text-[#64748b]">{index + 1}</span>
                    <input
                      className="w-full border border-[#334155] bg-[#111827] px-2 py-1.5 text-sm placeholder:text-[#475569]"
                      placeholder="Titulo do estagio"
                      value={stage.title}
                      onChange={(e) => updateStageDraft(index, { title: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => removeStageDraft(index)}
                      className="flex-shrink-0 font-mono text-[10px] text-red-400 underline hover:opacity-70"
                    >
                      Remover
                    </button>
                  </div>

                  <input
                    className="w-full border border-[#334155] bg-[#111827] px-2 py-1.5 text-sm placeholder:text-[#475569]"
                    placeholder="Topico livre (alternativa ao servico AWS)"
                    value={stage.topic}
                    onChange={(e) => updateStageDraft(index, { topic: e.target.value })}
                  />

                  <ServiceMultiSelect
                    allServices={services}
                    selectedCodes={stage.awsServiceId ? [stage.awsServiceId] : []}
                    onChange={(codes) => updateStageDraft(index, { awsServiceId: codes[0] ?? "" })}
                    single
                  />

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={stage.requireUnlockRule}
                      onChange={(e) => updateStageDraft(index, { requireUnlockRule: e.target.checked })}
                      className="accent-[#f97316]"
                    />
                    <span className="text-[10px] uppercase text-[#64748b]">Exigir desempenho minimo para desbloquear</span>
                  </label>

                  {stage.requireUnlockRule && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <select
                        className="w-full border border-[#334155] bg-[#111827] px-2 py-1.5 text-sm"
                        value={stage.unlockSessionType}
                        onChange={(e) =>
                          updateStageDraft(index, { unlockSessionType: e.target.value as "KC" | "SIMULADO" })
                        }
                      >
                        <option value="KC">KC</option>
                        <option value="SIMULADO">SIMULADO</option>
                      </select>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        className="w-full border border-[#334155] bg-[#111827] px-2 py-1.5 text-sm"
                        value={stage.unlockMinScorePercent}
                        onChange={(e) => updateStageDraft(index, { unlockMinScorePercent: Number(e.target.value) })}
                      />
                    </div>
                  )}
                </div>
              ))}
            </section>
          )}
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
            disabled={saving || !form.name}
            className="border border-[#1d4ed8] bg-blue-900/20 px-4 py-2 text-xs uppercase text-blue-300 disabled:opacity-40"
          >
            {saving ? "Salvando..." : isEdit ? "Salvar alteracoes" : "Criar trilha"}
          </button>
        </div>
      </div>
    </div>
  );
}
