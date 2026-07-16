"use client";

import { useEffect, useState } from "react";
import { AiArtworkGenerator } from "@/features/admin/components/AiArtworkGenerator";
import { ArtworkUploadField } from "@/features/admin/components/ArtworkUploadField";
import { ServiceMultiSelect, type ServiceOption } from "@/features/admin/components/ServiceMultiSelect";

export type Boss = {
  id: string;
  name: string;
  code: string;
  themeService: string;
  maxHp: number;
  damagePerCorrect: number;
  artworkUrl: string | null;
  active: boolean;
};

type FormState = {
  name: string;
  code: string;
  themeService: string;
  maxHp: number;
  damagePerCorrect: number;
  artworkUrl: string | null;
  active: boolean;
};

const EMPTY_FORM: FormState = {
  name: "",
  code: "",
  themeService: "",
  maxHp: 1000,
  damagePerCorrect: 10,
  artworkUrl: null,
  active: true,
};

type Props = {
  /** null = create mode. A boss object = edit mode, prefilled. */
  boss: Boss | null;
  onClose: () => void;
  onSaved: () => void;
};

export function BossFormModal({ boss, onClose, onSaved }: Props) {
  const isEdit = boss !== null;
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/study/services", { credentials: "include" })
      .then((res) => res.json())
      .then((json: { services?: ServiceOption[] }) => setServices(json.services ?? []))
      .catch(() => {
        // ServiceMultiSelect just shows an empty list when this fails; themeService can still be
        // set by editing an existing boss whose value already matches a code the admin knows.
      });
  }, []);

  useEffect(() => {
    if (boss) {
      setForm({
        name: boss.name,
        code: boss.code,
        themeService: boss.themeService,
        maxHp: boss.maxHp,
        damagePerCorrect: boss.damagePerCorrect,
        artworkUrl: boss.artworkUrl,
        active: boss.active,
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setError(null);
  }, [boss]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(isEdit ? `/api/admin/arena/bosses/${boss.id}` : "/api/admin/arena/bosses", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: form.name,
          code: form.code,
          themeService: form.themeService,
          maxHp: form.maxHp,
          damagePerCorrect: form.damagePerCorrect,
          artworkUrl: form.artworkUrl,
          active: form.active,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar boss");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar boss.");
    } finally {
      setSaving(false);
    }
  }

  // Balance helper: at damagePerCorrect per correct answer, this is how many
  // correct answers it takes to bring the boss from maxHp to 0.
  const approxQuestions = form.damagePerCorrect > 0 ? Math.ceil(form.maxHp / form.damagePerCorrect) : 0;

  function setApproxQuestions(target: number) {
    if (target <= 0 || form.damagePerCorrect <= 0) return;
    setForm((p) => ({ ...p, maxHp: target * p.damagePerCorrect }));
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4" role="dialog" aria-modal="true">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded border border-[#334155] bg-[#111827] text-[#e2e8f0]">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[#1e293b] px-6 py-4">
          <div>
            <p className="font-mono text-[10px] uppercase text-[#f97316]">{isEdit ? "Editar boss" : "Novo boss"}</p>
            <h2 className="mt-1 text-base font-semibold text-[#f8fafc]">{isEdit ? boss.name : "Criar boss"}</h2>
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
            <p className="font-mono text-[10px] uppercase text-[#94a3b8]">Identificacao</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-xs uppercase text-[#64748b]">Nome</span>
                <input
                  className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm placeholder:text-[#475569]"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs uppercase text-[#64748b]">Codigo unico</span>
                <input
                  className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm placeholder:text-[#475569]"
                  value={form.code}
                  onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                />
              </label>
            </div>
            <div className="space-y-1">
              <span className="text-xs uppercase text-[#64748b]">Servico AWS (tema)</span>
              <ServiceMultiSelect
                allServices={services}
                selectedCodes={form.themeService ? [form.themeService] : []}
                onChange={(codes) => setForm((p) => ({ ...p, themeService: codes[0] ?? "" }))}
                single
              />
            </div>
          </section>

          <section className="space-y-3">
            <p className="font-mono text-[10px] uppercase text-[#94a3b8]">Combate</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-xs uppercase text-[#64748b]">HP maximo</span>
                <input
                  type="number"
                  min={1}
                  className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm"
                  value={form.maxHp}
                  onChange={(e) => setForm((p) => ({ ...p, maxHp: Number(e.target.value) }))}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs uppercase text-[#64748b]">Dano por resposta certa</span>
                <input
                  type="number"
                  min={1}
                  className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm"
                  value={form.damagePerCorrect}
                  onChange={(e) => setForm((p) => ({ ...p, damagePerCorrect: Number(e.target.value) }))}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs uppercase text-[#64748b]">Questoes ate derrotar (alvo)</span>
                <input
                  type="number"
                  min={1}
                  className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm"
                  value={approxQuestions}
                  onChange={(e) => setApproxQuestions(Number(e.target.value))}
                />
              </label>
              <div className="flex items-center gap-2 pt-5">
                <input
                  type="checkbox"
                  id="boss-active"
                  checked={form.active}
                  onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))}
                  className="accent-[#f97316]"
                />
                <label htmlFor="boss-active" className="text-xs uppercase text-[#64748b]">
                  Ativo
                </label>
              </div>
            </div>
            <p className="border border-[#1e293b] bg-[#0b1220] px-3 py-2 font-mono text-[10px] text-[#94a3b8]">
              Com {form.damagePerCorrect} de dano por acerto, esse boss leva{" "}
              <span className="text-[#f97316]">~{approxQuestions} questao{approxQuestions === 1 ? "" : "es"}</span>{" "}
              corretas para ser derrotado. Ajuste o campo &quot;Questoes ate derrotar&quot; para recalcular o HP automaticamente.
            </p>
          </section>

          <section className="space-y-3 border-t border-[#1e293b] pt-5">
            <p className="font-mono text-[10px] uppercase text-[#94a3b8]">Arte</p>
            <AiArtworkGenerator
              simuladoName={form.name}
              endpoint="/api/admin/arena/bosses/generate-artwork"
              bodyKey="bossName"
              onConfirm={(dataUrl) => setForm((p) => ({ ...p, artworkUrl: dataUrl }))}
            />
            <ArtworkUploadField
              label="Ou envie a arte do boss"
              value={form.artworkUrl}
              onChange={(dataUrl) => setForm((p) => ({ ...p, artworkUrl: dataUrl }))}
            />
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
            disabled={saving || !form.name || !form.code || !form.themeService || !form.maxHp}
            className="border border-[#1d4ed8] bg-blue-900/20 px-4 py-2 text-xs uppercase text-blue-300 disabled:opacity-40"
          >
            {saving ? "Salvando..." : isEdit ? "Salvar alteracoes" : "Criar boss"}
          </button>
        </div>
      </div>
    </div>
  );
}
