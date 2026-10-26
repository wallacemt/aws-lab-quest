"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PixelButton } from "@/components/ui/pixel-button";
import { PixelCard } from "@/components/ui/pixel-card";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useUserProfile } from "@/hooks/useUserProfile";
import { STORAGE_KEYS, safeLocalStorageSet } from "@/lib/storage";
import type { RulesConsentMap } from "@/types/questions";

export type SimuladoConfig = {
  examStyle: "EXAM" | "EXPLAIN_EACH";
  timerMode: "COUNTDOWN_LOCK" | "COUNTUP_FREE" | "NONE";
  timerMinutes: number | null;
};
type Preset = SimuladoConfig & { id: string; name: string };
const defaultConfig: SimuladoConfig = { examStyle: "EXAM", timerMode: "COUNTDOWN_LOCK", timerMinutes: null };

const EXAM_STYLE_OPTIONS: { value: SimuladoConfig["examStyle"]; title: string; description: string }[] = [
  {
    value: "EXAM",
    title: "Prova real",
    description: "Você só descobre o que acertou e errou na revisão final, reproduzindo o exame oficial.",
  },
  {
    value: "EXPLAIN_EACH",
    title: "Explicação após cada resposta",
    description: "Mostra se você acertou e a explicação imediatamente após cada questão — bom para estudo ativo.",
  },
];

const TIMER_MODE_OPTIONS: { value: SimuladoConfig["timerMode"]; title: string; description: string }[] = [
  {
    value: "COUNTDOWN_LOCK",
    title: "Regressivo, bloqueia ao zerar",
    description: "Tempo total definido. Ao chegar a zero, o simulado é enviado automaticamente.",
  },
  {
    value: "COUNTUP_FREE",
    title: "Cronômetro livre",
    description: "Conta o tempo gasto apenas como referência, sem bloquear ou enviar o simulado.",
  },
  {
    value: "NONE",
    title: "Sem cronômetro",
    description: "Nenhuma contagem de tempo — ideal para revisão sem pressão.",
  },
];

export function SimuladoConfigScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile } = useUserProfile();
  const rulesConsent = useLocalStorage<RulesConsentMap>(STORAGE_KEYS.simuladoRulesConsent, {});
  const consentScope = profile.certificationPresetCode?.trim() || "default";

  const packId = searchParams.get("packId");
  const packName = searchParams.get("packName");
  const examMinutes = Number(searchParams.get("examMinutes") ?? 90) || 90;

  const [config, setConfig] = useState<SimuladoConfig>(defaultConfig);
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [view, setView] = useState<"config" | "presets" | "create">("config");
  const [presets, setPresets] = useState<Preset[]>([]);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [presetError, setPresetError] = useState("");

  useEffect(() => {
    fetch("/api/user/simulado-presets")
      .then(async (r) => {
        if (r.ok) setPresets((await r.json()).presets);
      })
      .catch(() => {});
  }, []);

  const visiblePresets = useMemo(
    () => presets.filter((preset) => preset.name.toLowerCase().includes(search.trim().toLowerCase())),
    [presets, search],
  );

  async function createPreset() {
    setPresetError("");
    const response = await fetch("/api/user/simulado-presets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...config,
        timerMinutes: config.timerMode === "COUNTDOWN_LOCK" ? config.timerMinutes ?? examMinutes : null,
        name,
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      setPresetError(result.error ?? "Não foi possível salvar.");
      return;
    }
    setPresets((current) => [result.preset, ...current]);
    setConfig(result.preset);
    setView("config");
  }

  function handleCancel() {
    router.push("/simulado");
  }

  function handleConfirm() {
    if (!rulesAccepted || !packId) return;

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    rulesConsent.setValue((prev) => ({ ...prev, [consentScope]: expiresAt }));

    safeLocalStorageSet(STORAGE_KEYS.simuladoPendingStart, { packId, config });
    router.push("/simulado");
  }

  if (!packId) {
    return (
      <main className="mx-auto max-w-2xl p-4">
        <PixelCard className="space-y-4">
          <p className="font-[var(--font-body)] text-sm text-[var(--pixel-text)]">
            Nenhum simulado selecionado. Volte e escolha um pacote para configurar.
          </p>
          <PixelButton onClick={handleCancel}>Voltar para Simulados</PixelButton>
        </PixelCard>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4">
      <PixelCard className="space-y-1">
        <p className="font-mono text-[10px] uppercase text-[var(--pixel-primary)]">Configurar Simulado</p>
        <h1 className="font-[var(--font-body)] text-xl text-[var(--pixel-text)]">{packName ?? "Ambiente de prova real"}</h1>
        <p className="font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
          Escolha como quer ser avaliado e como o tempo deve se comportar antes de iniciar.
        </p>
      </PixelCard>

      <PixelCard className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <PixelButton
            variant={
              view === "config" && config.examStyle === "EXAM" && config.timerMode === "COUNTDOWN_LOCK" && config.timerMinutes === null
                ? "primary"
                : "ghost"
            }
            onClick={() => {
              setConfig(defaultConfig);
              setView("config");
            }}
          >
            Padrão
          </PixelButton>
          <PixelButton variant={view === "presets" ? "primary" : "ghost"} onClick={() => setView("presets")}>
            Selecionar preset
          </PixelButton>
          <PixelButton variant={view === "create" ? "primary" : "ghost"} onClick={() => setView("create")}>
            Criar preset
          </PixelButton>
        </div>

        {view === "config" && (
          <div className="space-y-5">
            <div>
              <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Estilo de prova</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {EXAM_STYLE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setConfig((prev) => ({ ...prev, examStyle: option.value }))}
                    className={[
                      "border-2 p-3 text-left font-[var(--font-body)] transition-colors",
                      config.examStyle === option.value
                        ? "border-[var(--pixel-primary)] bg-[var(--pixel-bg)]"
                        : "border-[var(--pixel-border)] hover:border-[var(--pixel-primary)]",
                    ].join(" ")}
                  >
                    <strong className="block text-sm text-[var(--pixel-text)]">{option.title}</strong>
                    <span className="mt-1 block text-xs text-[var(--pixel-subtext)]">{option.description}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Cronômetro</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {TIMER_MODE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      setConfig((prev) => ({
                        ...prev,
                        timerMode: option.value,
                        timerMinutes: option.value === "COUNTDOWN_LOCK" ? prev.timerMinutes ?? examMinutes : null,
                      }))
                    }
                    className={[
                      "border-2 p-3 text-left font-[var(--font-body)] transition-colors",
                      config.timerMode === option.value
                        ? "border-[var(--pixel-primary)] bg-[var(--pixel-bg)]"
                        : "border-[var(--pixel-border)] hover:border-[var(--pixel-primary)]",
                    ].join(" ")}
                  >
                    <strong className="block text-sm text-[var(--pixel-text)]">{option.title}</strong>
                    <span className="mt-1 block text-xs text-[var(--pixel-subtext)]">{option.description}</span>
                  </button>
                ))}
              </div>

              {config.timerMode === "COUNTDOWN_LOCK" && (
                <label className="mt-3 block font-[var(--font-body)] text-sm text-[var(--pixel-text)]">
                  Minutos de prova
                  <input
                    aria-label="Minutos de prova"
                    type="number"
                    min={1}
                    max={600}
                    value={config.timerMinutes ?? examMinutes}
                    onChange={(e) => setConfig((prev) => ({ ...prev, timerMinutes: Math.max(1, Number(e.target.value)) }))}
                    className="mt-1 block w-40 border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] p-2"
                  />
                </label>
              )}
            </div>
          </div>
        )}

        {view === "presets" && (
          <div className="space-y-2">
            <input
              aria-label="Buscar presets"
              placeholder="Buscar preset..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] p-2 font-[var(--font-body)]"
            />
            <div className="max-h-56 space-y-2 overflow-y-auto">
              {visiblePresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setConfig(preset);
                    setView("config");
                  }}
                  className="block w-full border-2 border-[var(--pixel-border)] p-2 text-left font-[var(--font-body)] hover:border-[var(--pixel-primary)]"
                >
                  <strong>{preset.name}</strong>
                  <span className="block text-xs text-[var(--pixel-subtext)]">
                    {preset.examStyle} · {preset.timerMode}
                    {preset.timerMode === "COUNTDOWN_LOCK" ? ` · ${preset.timerMinutes ?? examMinutes} min` : ""}
                  </span>
                </button>
              ))}
            </div>
            {visiblePresets.length === 0 && (
              <p className="font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">Nenhum preset encontrado.</p>
            )}
          </div>
        )}

        {view === "create" && (
          <div className="space-y-2">
            <input
              aria-label="Nome do preset"
              maxLength={40}
              placeholder="Nome do preset"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] p-2 font-[var(--font-body)]"
            />
            {presetError && (
              <p role="alert" className="text-sm text-red-400">
                {presetError}
              </p>
            )}
            <PixelButton onClick={() => void createPreset()} disabled={!name.trim()}>
              Salvar configuração atual
            </PixelButton>
          </div>
        )}

        <p className="font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">
          Presets usam busca e filtro local; o limite por usuário mantém essa lista pequena.
        </p>
      </PixelCard>

      <PixelCard className="space-y-3">
        <p className="font-mono text-[10px] uppercase text-yellow-300">Regras do Simulado</p>
        <ul className="space-y-2 font-[var(--font-body)] text-sm text-[var(--pixel-text)]">
          <li>1. O simulado apresenta questões em sequência; o estilo e o cronômetro seguem a configuração escolhida acima.</li>
          <li>2. Não é permitido consultar materiais externos durante a prova.</li>
          <li>3. O objetivo é simular o ambiente real da certificação AWS.</li>
          <li>4. Ao iniciar, mantenha foco contínuo até o envio final.</li>
        </ul>

        <label className="flex items-start gap-3 border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-3">
          <input type="checkbox" checked={rulesAccepted} onChange={(e) => setRulesAccepted(e.target.checked)} className="mt-1" />
          <span className="font-[var(--font-body)] text-sm text-[var(--pixel-text)]">
            Li e aceito as regras do simulado para reproduzir um ambiente real de prova.
          </span>
        </label>

        <div className="flex justify-end gap-2">
          <PixelButton variant="ghost" onClick={handleCancel}>
            Cancelar
          </PixelButton>
          <PixelButton onClick={handleConfirm} disabled={!rulesAccepted}>
            Iniciar simulado
          </PixelButton>
        </div>
      </PixelCard>
    </main>
  );
}
