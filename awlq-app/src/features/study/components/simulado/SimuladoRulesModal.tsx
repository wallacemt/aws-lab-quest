"use client";

import { PixelButton } from "@/components/ui/pixel-button";
import { PixelCard } from "@/components/ui/pixel-card";
import { useEffect, useMemo, useState } from "react";

export type SimuladoConfig = { examStyle: "EXAM" | "EXPLAIN_EACH"; timerMode: "COUNTDOWN_LOCK" | "COUNTUP_FREE" | "NONE"; timerMinutes: number | null };
type Preset = SimuladoConfig & { id: string; name: string };
const defaultConfig: SimuladoConfig = { examStyle: "EXAM", timerMode: "COUNTDOWN_LOCK", timerMinutes: null };

type Props = {
  open: boolean;
  packName: string | null;
  rulesAccepted: boolean;
  loading: boolean;
  onAcceptedChange: (accepted: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
  examMinutes: number;
  config: SimuladoConfig;
  onConfigChange: (config: SimuladoConfig) => void;
};

export function SimuladoRulesModal({ open, packName, rulesAccepted, loading, onAcceptedChange, onCancel, onConfirm, examMinutes, config, onConfigChange }: Props) {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [view, setView] = useState<"config" | "presets" | "create">("config");
  useEffect(() => { if (!open) return; fetch("/api/user/simulado-presets").then(async (r) => { if (r.ok) setPresets((await r.json()).presets); }).catch(() => {}); }, [open]);
  const visiblePresets = useMemo(() => presets.filter((preset) => preset.name.toLowerCase().includes(search.trim().toLowerCase())), [presets, search]);
  async function createPreset() {
    setError("");
    const response = await fetch("/api/user/simulado-presets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...config, timerMinutes: config.timerMode === "COUNTDOWN_LOCK" ? (config.timerMinutes ?? examMinutes) : null, name }) });
    const result = await response.json();
    if (!response.ok) { setError(result.error ?? "Nao foi possivel salvar."); return; }
    setPresets((current) => [result.preset, ...current]);
    onConfigChange(result.preset);
    setView("config");
  }
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4" role="dialog" aria-modal="true">
      <PixelCard className="w-full max-w-2xl space-y-4 border-yellow-500 bg-yellow-900/95">
        <p className="font-mono text-[10px] uppercase text-yellow-300">Regras do Simulado</p>
        <h3 className="font-[var(--font-body)] text-xl">
          {packName ?? "Ambiente de prova real"}
        </h3>

        <div className="space-y-3 border-y border-[var(--pixel-border)] py-3">
          <div className="flex flex-wrap gap-2">
            <PixelButton variant={view === "config" && config.examStyle === "EXAM" && config.timerMode === "COUNTDOWN_LOCK" && config.timerMinutes === null ? "primary" : "ghost"} onClick={() => { onConfigChange(defaultConfig); setView("config"); }}>Padrão</PixelButton>
            <PixelButton variant={view === "presets" ? "primary" : "ghost"} onClick={() => setView("presets")}>Selecionar preset</PixelButton>
            <PixelButton variant={view === "create" ? "primary" : "ghost"} onClick={() => setView("create")}>Criar preset</PixelButton>
          </div>
          {view === "config" && <div className="grid gap-3 sm:grid-cols-2">
            <label className="font-[var(--font-body)] text-sm">Estilo<select aria-label="Estilo do simulado" value={config.examStyle} onChange={(e) => onConfigChange({ ...config, examStyle: e.target.value as SimuladoConfig["examStyle"] })} className="mt-1 block w-full border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] p-2"><option value="EXAM">Prova real — revisao no final</option><option value="EXPLAIN_EACH">Explicacao apos cada resposta</option></select></label>
            <label className="font-[var(--font-body)] text-sm">Cronometro<select aria-label="Modo de cronometro" value={config.timerMode} onChange={(e) => onConfigChange({ ...config, timerMode: e.target.value as SimuladoConfig["timerMode"], timerMinutes: e.target.value === "COUNTDOWN_LOCK" ? (config.timerMinutes ?? examMinutes) : null })} className="mt-1 block w-full border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] p-2"><option value="COUNTDOWN_LOCK">Regressivo, bloqueia ao zerar</option><option value="COUNTUP_FREE">Cronometra sem bloquear</option><option value="NONE">Sem cronometro</option></select></label>
            {config.timerMode === "COUNTDOWN_LOCK" && <label className="font-[var(--font-body)] text-sm">Minutos<input aria-label="Minutos de prova" type="number" min={1} max={600} value={config.timerMinutes ?? examMinutes} onChange={(e) => onConfigChange({ ...config, timerMinutes: Math.max(1, Number(e.target.value)) })} className="mt-1 block w-full border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] p-2" /></label>}
          </div>}
          {view === "presets" && <div className="space-y-2"><input aria-label="Buscar presets" placeholder="Buscar preset..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] p-2 font-[var(--font-body)]"/><div className="max-h-40 space-y-2 overflow-y-auto">{visiblePresets.map((preset) => <button key={preset.id} type="button" onClick={() => { onConfigChange(preset); setView("config"); }} className="block w-full border-2 border-[var(--pixel-border)] p-2 text-left font-[var(--font-body)] hover:border-[var(--pixel-primary)]"><strong>{preset.name}</strong><span className="block text-xs text-[var(--pixel-subtext)]">{preset.examStyle} · {preset.timerMode}{preset.timerMode === "COUNTDOWN_LOCK" ? ` · ${preset.timerMinutes ?? examMinutes} min` : ""}</span></button>)}</div>{visiblePresets.length === 0 && <p className="font-[var(--font-body)] text-sm">Nenhum preset encontrado.</p>}</div>}
          {view === "create" && <div className="space-y-2"><input aria-label="Nome do preset" maxLength={40} placeholder="Nome do preset" value={name} onChange={(e) => setName(e.target.value)} className="w-full border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] p-2 font-[var(--font-body)]"/>{error && <p role="alert" className="text-sm text-red-400">{error}</p>}<PixelButton onClick={() => void createPreset()} disabled={!name.trim()}>Salvar configuração atual</PixelButton></div>}
          <p className="font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">Presets usam busca e filtro local; o limite por usuário mantém essa lista pequena.</p>
        </div>

        <ul className="space-y-2 font-[var(--font-body)] text-sm text-[var(--pixel-text)]">
          <li>1. O simulado apresenta questões em sequência; o estilo e o cronômetro seguem a configuração escolhida acima.</li>
          <li>2. Nao e permitido consultar materiais externos durante a prova.</li>
          <li>3. O objetivo e simular o ambiente real da certificacao AWS.</li>
          <li>4. Ao iniciar, mantenha foco continuo ate o envio final.</li>
        </ul>

        <label className="flex items-start gap-3 border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-3">
          <input
            type="checkbox"
            checked={rulesAccepted}
            onChange={(e) => onAcceptedChange(e.target.checked)}
            className="mt-1"
          />
          <span className="font-[var(--font-body)] text-sm">
            Li e aceito as regras do simulado para reproduzir um ambiente real de prova.
          </span>
        </label>

        <div className="flex justify-end gap-2">
          <PixelButton variant="ghost" onClick={onCancel}>
            Cancelar
          </PixelButton>
          <PixelButton onClick={onConfirm} disabled={!rulesAccepted || loading}>
            Aceitar e iniciar simulado
          </PixelButton>
        </div>
      </PixelCard>
    </div>
  );
}
