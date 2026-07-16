"use client";

import { useEffect, useState } from "react";
import type { CertificationOption } from "@/features/admin/types";

export type Chain = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  displayOrder: number;
  certificationPresetId: string | null;
};

type FormState = {
  name: string;
  description: string;
  certificationPresetId: string;
  active: boolean;
  displayOrder: number;
};

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  certificationPresetId: "",
  active: true,
  displayOrder: 0,
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
    if (chain) {
      setForm({
        name: chain.name,
        description: chain.description ?? "",
        certificationPresetId: chain.certificationPresetId ?? "",
        active: chain.active,
        displayOrder: chain.displayOrder,
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setError(null);
  }, [chain]);

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
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar trilha");
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
