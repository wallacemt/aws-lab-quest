"use client";

import { useEffect, useState } from "react";
import { AiArtworkGenerator } from "@/features/admin/components/AiArtworkGenerator";
import { ArtworkUploadField } from "@/features/admin/components/ArtworkUploadField";
import { TRIGGER_TYPES, type TriggerParams, type TriggerType } from "@/lib/achievement-triggers";
import Image from "next/image";

export type Achievement = {
  id: string;
  code: string;
  name: string;
  description: string;
  rarity: string;
  imageUrl: string | null;
  active: boolean;
  displayOrder: number;
  target: number;
  triggerType: TriggerType;
  triggerParams: TriggerParams | null;
};

type Suggestion = {
  name: string;
  description: string;
  rarity: string;
  triggerType: TriggerType;
  triggerParams: TriggerParams | null;
  target: number;
};

type FormState = {
  code: string;
  name: string;
  description: string;
  rarity: string;
  target: number;
  displayOrder: number;
  active: boolean;
  triggerType: TriggerType;
  triggerParams: TriggerParams;
  imageUrl: string | null;
};

const RARITIES = ["common", "uncommon", "rare", "epic", "legendary"];
const SESSION_TYPES = ["KC", "SIMULADO"] as const;

export const TRIGGER_TYPE_LABELS: Record<TriggerType, string> = {
  LAB_COUNT: "Contagem de labs",
  SESSION_COUNT: "Contagem de sessoes por tipo",
  SESSION_SCORE_COUNT: "Contagem de sessoes com nota minima",
  XP_TOTAL: "XP total",
  STREAK_DAYS: "Sequencia de dias (labs + estudo)",
  TOTAL_SESSIONS: "Total de sessoes (labs + estudo)",
  CERT_COUNT: "Certificacoes registradas",
  XP_AND_SESSION_SCORE_COMBO: "Combo: XP total + sessoes com nota minima",
  ARENA_VICTORY_COUNT: "Arena: vitorias contra bosses",
  FLASHCARD_REVIEW_COUNT: "Flashcards: total de revisoes",
  FLASHCARD_REVIEW_STREAK_DAYS: "Flashcards: sequencia de dias revisando",
  MENTOR_CONSULTED: "Mestre: consultou pelo menos uma vez",
  GAP_CLEARED_COUNT: "Gaps de conhecimento fechados",
  SPRINT_COUNT: "Sprints de flashcards concluidos",
  TRAIL_STAGE_COUNT: "Trilhas: estagios concluidos",
  TRAIL_CHAIN_COMPLETED_COUNT: "Trilhas: trilhas completas",
  LIBRARY_ACCESS_COUNT: "Biblioteca: conteudos acessados",
};

function needsSessionType(t: TriggerType) {
  return t === "SESSION_COUNT" || t === "SESSION_SCORE_COUNT" || t === "XP_AND_SESSION_SCORE_COMBO";
}
function needsMinScorePercent(t: TriggerType) {
  return t === "SESSION_SCORE_COUNT" || t === "XP_AND_SESSION_SCORE_COMBO";
}
function needsCombo(t: TriggerType) {
  return t === "XP_AND_SESSION_SCORE_COMBO";
}

const COMBINING_DIACRITICS = /[\u0300-\u036f]/g;

function slugifyCode(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const EMPTY_FORM: FormState = {
  code: "",
  name: "",
  description: "",
  rarity: "common",
  target: 1,
  displayOrder: 0,
  active: true,
  triggerType: "XP_TOTAL",
  triggerParams: {},
  imageUrl: null,
};

function TriggerParamsFields({
  triggerType,
  params,
  onChange,
}: {
  triggerType: TriggerType;
  params: TriggerParams;
  onChange: (params: TriggerParams) => void;
}) {
  if (!needsSessionType(triggerType)) return null;

  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      <div>
        <label className="block font-mono text-[10px] uppercase text-[#94a3b8] mb-1">Tipo de sessao</label>
        <select
          className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 font-mono text-xs text-[#e2e8f0]"
          value={params.sessionType ?? ""}
          onChange={(e) => onChange({ ...params, sessionType: e.target.value as "KC" | "SIMULADO" })}
        >
          <option value="">Selecione...</option>
          {SESSION_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      {needsMinScorePercent(triggerType) && (
        <div>
          <label className="block font-mono text-[10px] uppercase text-[#94a3b8] mb-1">Nota minima (%)</label>
          <input
            type="number"
            min={0}
            max={100}
            className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 font-mono text-xs text-[#e2e8f0]"
            value={params.minScorePercent ?? ""}
            onChange={(e) => onChange({ ...params, minScorePercent: Number(e.target.value) })}
          />
        </div>
      )}
      {needsCombo(triggerType) && (
        <>
          <div>
            <label className="block font-mono text-[10px] uppercase text-[#94a3b8] mb-1">Limiar de XP</label>
            <input
              type="number"
              min={1}
              className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 font-mono text-xs text-[#e2e8f0]"
              value={params.xpThreshold ?? ""}
              onChange={(e) => onChange({ ...params, xpThreshold: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="block font-mono text-[10px] uppercase text-[#94a3b8] mb-1">Qtde minima de sessoes</label>
            <input
              type="number"
              min={1}
              className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 font-mono text-xs text-[#e2e8f0]"
              value={params.sessionCountThreshold ?? ""}
              onChange={(e) => onChange({ ...params, sessionCountThreshold: Number(e.target.value) })}
            />
          </div>
        </>
      )}
    </div>
  );
}

type Props = {
  /** null = create mode. An achievement object = edit mode, prefilled. */
  achievement: Achievement | null;
  onClose: () => void;
  onSaved: () => void;
};

export function AchievementFormModal({ achievement, onClose, onSaved }: Props) {
  const isEdit = achievement !== null;
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  useEffect(() => {
    if (achievement) {
      setForm({
        code: achievement.code,
        name: achievement.name,
        description: achievement.description,
        rarity: achievement.rarity,
        target: achievement.target,
        displayOrder: achievement.displayOrder,
        active: achievement.active,
        triggerType: achievement.triggerType,
        triggerParams: achievement.triggerParams ?? {},
        imageUrl: achievement.imageUrl,
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setError(null);
    setSuggestions([]);
  }, [achievement]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(isEdit ? `/api/admin/achievements/${achievement.id}` : "/api/admin/achievements", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          code: form.code,
          name: form.name,
          description: form.description,
          rarity: form.rarity,
          target: form.target,
          displayOrder: form.displayOrder,
          active: form.active,
          triggerType: form.triggerType,
          triggerParams: needsSessionType(form.triggerType) ? form.triggerParams : null,
          imageUrl: form.imageUrl,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar conquista");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar conquista.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSuggest() {
    setSuggestLoading(true);
    setSuggestError(null);
    try {
      const res = await fetch("/api/admin/achievements/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ count: 3 }),
      });
      const data = (await res.json()) as { candidates?: Suggestion[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Falha ao gerar sugestoes");
      setSuggestions(data.candidates ?? []);
    } catch (err) {
      setSuggestError(err instanceof Error ? err.message : "Erro ao gerar sugestoes.");
    } finally {
      setSuggestLoading(false);
    }
  }

  function applySuggestion(suggestion: Suggestion) {
    setForm({
      code: slugifyCode(suggestion.name),
      name: suggestion.name,
      description: suggestion.description,
      rarity: suggestion.rarity,
      target: suggestion.target,
      displayOrder: 0,
      active: true,
      triggerType: suggestion.triggerType,
      triggerParams: suggestion.triggerParams ?? {},
      imageUrl: null,
    });
    setSuggestions([]);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4" role="dialog" aria-modal="true">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded border border-[#334155] bg-[#111827] text-[#e2e8f0]">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[#1e293b] px-6 py-4">
          <div>
            <p className="font-mono text-[10px] uppercase text-[#f97316]">
              {isEdit ? "Editar conquista" : "Nova conquista"}
            </p>
            <h2 className="mt-1 text-base font-semibold text-[#f8fafc]">
              {isEdit ? achievement.name : "Criar conquista"}
            </h2>
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
          {error && <p className="border border-[#7f1d1d] bg-red-900/20 px-3 py-2 text-xs text-[#fca5a5]">{error}</p>}
          {achievement?.imageUrl && (
            <div className="flex items-center justify-center">
              <img src={achievement?.imageUrl} className="h-60 w-60 rounded-full  " alt={achievement.name} />
            </div>
          )}
          {!isEdit && (
            <section className="space-y-2 border border-dashed border-[#1e3a5f] bg-[#0b1220] p-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase text-[#38bdf8]">✦ Sugestao via IA</span>
                <button
                  type="button"
                  onClick={() => void handleSuggest()}
                  disabled={suggestLoading}
                  className="border border-[#1e3a5f] bg-[#0f172a] px-3 py-1 font-mono text-[10px] uppercase text-[#38bdf8] hover:bg-[#1e3a5f]/30 disabled:opacity-40"
                >
                  {suggestLoading ? "Gerando..." : "Sugerir com IA"}
                </button>
              </div>

              {suggestError && <p className="font-mono text-[10px] text-[#fca5a5]">{suggestError}</p>}

              {suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1e293b] py-2 last:border-0"
                >
                  <div>
                    <p className="text-xs text-[#e2e8f0]">
                      {suggestion.name}{" "}
                      <span className="text-[#64748b]">
                        ({suggestion.rarity}, {TRIGGER_TYPE_LABELS[suggestion.triggerType]})
                      </span>
                    </p>
                    <p className="text-[10px] text-[#94a3b8]">{suggestion.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => applySuggestion(suggestion)}
                    className="border border-[#334155] px-3 py-1 font-mono text-[10px] uppercase text-[#94a3b8] hover:border-[#f97316] hover:text-[#f97316]"
                  >
                    Usar
                  </button>
                </div>
              ))}
            </section>
          )}

          {/* Identification */}
          <section className="space-y-3">
            <p className="font-mono text-[10px] uppercase text-[#94a3b8]">Identificacao</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-xs uppercase text-[#64748b]">Codigo unico</span>
                <input
                  className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm placeholder:text-[#475569]"
                  value={form.code}
                  onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs uppercase text-[#64748b]">Nome</span>
                <input
                  className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm placeholder:text-[#475569]"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                />
              </label>
              <label className="block space-y-1 sm:col-span-2">
                <span className="text-xs uppercase text-[#64748b]">Descricao</span>
                <textarea
                  rows={2}
                  className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm placeholder:text-[#475569]"
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs uppercase text-[#64748b]">Raridade</span>
                <select
                  className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm"
                  value={form.rarity}
                  onChange={(e) => setForm((p) => ({ ...p, rarity: e.target.value }))}
                >
                  {RARITIES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-xs uppercase text-[#64748b]">Target (limiar de progresso)</span>
                <input
                  type="number"
                  min={1}
                  className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm"
                  value={form.target}
                  onChange={(e) => setForm((p) => ({ ...p, target: Number(e.target.value) }))}
                />
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
              <div className="flex items-center gap-2 pt-5">
                <input
                  type="checkbox"
                  id="achv-active"
                  checked={form.active}
                  onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))}
                  className="accent-[#f97316]"
                />
                <label htmlFor="achv-active" className="text-xs uppercase text-[#64748b]">
                  Ativa
                </label>
              </div>
            </div>
          </section>

          {/* Trigger */}
          <section className="space-y-3">
            <p className="font-mono text-[10px] uppercase text-[#94a3b8]">Gatilho de desbloqueio</p>
            <label className="block space-y-1">
              <span className="text-xs uppercase text-[#64748b]">Tipo de gatilho</span>
              <select
                className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm"
                value={form.triggerType}
                onChange={(e) =>
                  setForm((p) => ({ ...p, triggerType: e.target.value as TriggerType, triggerParams: {} }))
                }
              >
                {TRIGGER_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TRIGGER_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
            <TriggerParamsFields
              triggerType={form.triggerType}
              params={form.triggerParams}
              onChange={(triggerParams) => setForm((p) => ({ ...p, triggerParams }))}
            />
          </section>

          {/* Artwork */}
          <section className="space-y-3 border-t border-[#1e293b] pt-5">
            <p className="font-mono text-[10px] uppercase text-[#94a3b8]">Arte do badge</p>
            <AiArtworkGenerator
              simuladoName={form.name}
              endpoint="/api/admin/achievements/generate-artwork"
              bodyKey="achievementName"
              onConfirm={(dataUrl) => setForm((p) => ({ ...p, imageUrl: dataUrl }))}
            />
            <ArtworkUploadField
              label="Ou envie a arte do badge"
              value={form.imageUrl}
              onChange={(dataUrl) => setForm((p) => ({ ...p, imageUrl: dataUrl }))}
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
            disabled={saving || !form.code || !form.name}
            className="border border-[#1d4ed8] bg-blue-900/20 px-4 py-2 text-xs uppercase text-blue-300 disabled:opacity-40"
          >
            {saving ? "Salvando..." : isEdit ? "Salvar alteracoes" : "Criar conquista"}
          </button>
        </div>
      </div>
    </div>
  );
}
