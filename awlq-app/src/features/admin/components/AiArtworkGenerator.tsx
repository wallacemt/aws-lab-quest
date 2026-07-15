"use client";

import { useEffect, useState } from "react";

type Props = {
  simuladoName: string;
  onConfirm: (dataUrl: string) => void;
  disabled?: boolean;
  /** Admin artwork-generation route to call. Defaults to the simulado pack route. */
  endpoint?: string;
  /** Body field name the route expects for the subject name. Defaults to the simulado route's field. */
  bodyKey?: string;
};

type GenerateResponse = {
  prompt: string;
  dataUrl: string;
  seed: number;
};

type PollinationsModel = {
  name: string;
  title: string;
};

const DEFAULT_MODEL = "flux";
const FALLBACK_MODELS: PollinationsModel[] = [{ name: DEFAULT_MODEL, title: "Flux Schnell" }];

type Phase =
  | { kind: "idle" }
  | { kind: "generating"; mode: "ai" | "custom" }
  | { kind: "preview"; prompt: string; dataUrl: string }
  | { kind: "asking-prompt-choice"; lastPrompt: string }
  | { kind: "custom-prompt"; draft: string };

export function AiArtworkGenerator({
  simuladoName,
  onConfirm,
  disabled,
  endpoint = "/api/admin/simulado-packs/generate-artwork",
  bodyKey = "simuladoName",
}: Props) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [availableModels, setAvailableModels] = useState<PollinationsModel[]>(FALLBACK_MODELS);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);

  useEffect(() => {
    let cancelled = false;
    setModelsLoading(true);
    fetch("/api/admin/pollinations-models", { credentials: "include" })
      .then((res) => res.json())
      .then((json: { models?: PollinationsModel[] }) => {
        if (!cancelled && json.models && json.models.length > 0) {
          setAvailableModels(json.models);
        }
      })
      .catch(() => {
        // Keep the flux-only fallback — generation still works with the default model.
      })
      .finally(() => {
        if (!cancelled) setModelsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const nameMissing = !simuladoName.trim();

  async function runGeneration(opts: { customPrompt?: string }) {
    setError(null);
    setPhase({ kind: "generating", mode: opts.customPrompt ? "custom" : "ai" });
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          [bodyKey]: simuladoName.trim(),
          customPrompt: opts.customPrompt,
          model: selectedModel,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as Partial<GenerateResponse> & { error?: string };
      if (!res.ok || !json.dataUrl || !json.prompt) {
        setError(json.error ?? "Falha ao gerar arte.");
        setPhase({ kind: "idle" });
        return;
      }
      setPhase({ kind: "preview", prompt: json.prompt, dataUrl: json.dataUrl });
    } catch {
      setError("Erro de conexao ao gerar arte.");
      setPhase({ kind: "idle" });
    }
  }

  function handleConfirm() {
    if (phase.kind !== "preview") return;
    onConfirm(phase.dataUrl);
    setPhase({ kind: "idle" });
  }

  function handleAskRegenerate() {
    if (phase.kind !== "preview") return;
    setPhase({ kind: "asking-prompt-choice", lastPrompt: phase.prompt });
  }

  function handleChoiceWriteOwn() {
    if (phase.kind !== "asking-prompt-choice") return;
    setPhase({ kind: "custom-prompt", draft: phase.lastPrompt });
  }

  function handleChoiceUseAi() {
    void runGeneration({});
  }
  return (
    <div className="space-y-2 border border-dashed border-[#1e3a5f] bg-[#0b1220] p-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase text-[#38bdf8]">
          ✦ Gerar arte com IA
        </span>
        {phase.kind === "idle" && (
          <button
            type="button"
            onClick={() => void runGeneration({})}
            disabled={disabled || nameMissing}
            title={nameMissing ? "Informe o nome do simulado primeiro" : undefined}
            className="border border-[#1e3a5f] bg-[#0f172a] px-3 py-1 font-mono text-[10px] uppercase text-[#38bdf8] hover:bg-[#1e3a5f]/30 disabled:opacity-40"
          >
            Gerar com IA
          </button>
        )}
      </div>

      {(phase.kind === "idle" || phase.kind === "custom-prompt" || phase.kind === "asking-prompt-choice") && (
        <label className="block space-y-1">
          <span className="font-mono text-[10px] uppercase text-[#64748b]">
            Modelo {modelsLoading ? "(carregando...)" : ""}
          </span>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            disabled={disabled}
            className="w-full border border-[#334155] bg-[#111827] px-3 py-1.5 text-xs text-[#e2e8f0] outline-none focus:border-[#38bdf8] disabled:opacity-40"
          >
            {availableModels.map((m) => (
              <option key={m.name} value={m.name}>
                {m.title}
              </option>
            ))}
          </select>
        </label>
      )}

      {nameMissing && phase.kind === "idle" && (
        <p className="font-[var(--font-body)] text-[10px] text-[#64748b]">
          Informe o nome do simulado para gerar a arte automaticamente.
        </p>
      )}

      {phase.kind === "generating" && (
        <p className="text-[11px] text-[#94a3b8]">
          {phase.mode === "custom" ? "Gerando imagem com seu prompt..." : "Gerando prompt e imagem..."}
        </p>
      )}

      {phase.kind === "preview" && (
        <div className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={phase.dataUrl}
            alt="Arte gerada"
            className="h-48 w-full border border-[#1e293b] object-cover"
          />
          <div className="border border-[#1e293b] bg-[#0f172a] p-2">
            <p className="font-mono text-[9px] uppercase text-[#475569]">Prompt usado</p>
            <p className="mt-1 text-[10px] text-[#94a3b8]">{phase.prompt}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleConfirm}
              className="border border-green-700 bg-green-900/20 px-3 py-1.5 font-mono text-[10px] uppercase text-green-300 hover:bg-green-900/30"
            >
              Confirmar imagem
            </button>
            <button
              type="button"
              onClick={handleAskRegenerate}
              className="border border-[#334155] px-3 py-1.5 font-mono text-[10px] uppercase text-[#94a3b8] hover:border-[#475569]"
            >
              Gerar novamente
            </button>
          </div>
        </div>
      )}

      {phase.kind === "asking-prompt-choice" && (
        <div className="space-y-2">
          <p className="text-[11px] text-[#cbd5e1]">
            Deseja escrever um prompt personalizado para a proxima geracao?
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleChoiceWriteOwn}
              className="border border-[#1e3a5f] bg-[#0f172a] px-3 py-1.5 font-mono text-[10px] uppercase text-[#38bdf8] hover:bg-[#1e3a5f]/30"
            >
              Sim, escrever prompt
            </button>
            <button
              type="button"
              onClick={handleChoiceUseAi}
              className="border border-[#334155] px-3 py-1.5 font-mono text-[10px] uppercase text-[#94a3b8] hover:border-[#475569]"
            >
              Nao, gerar de novo com IA
            </button>
            <button
              type="button"
              onClick={() => setPhase({ kind: "idle" })}
              className="border border-[#334155] px-3 py-1.5 font-mono text-[10px] uppercase text-[#64748b]"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {phase.kind === "custom-prompt" && (
        <div className="space-y-2">
          <label className="block font-mono text-[10px] uppercase text-[#64748b]">
            Prompt personalizado (em ingles funciona melhor)
          </label>
          <textarea
            value={phase.draft}
            onChange={(e) => setPhase({ kind: "custom-prompt", draft: e.target.value })}
            rows={4}
            className="w-full border border-[#334155] bg-[#111827] px-3 py-2 text-xs text-[#e2e8f0] outline-none focus:border-[#38bdf8]"
            placeholder="Descreva a cena, mencione elementos AWS, estilo visual..."
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void runGeneration({ customPrompt: phase.draft.trim() })}
              disabled={!phase.draft.trim()}
              className="border border-[#1e3a5f] bg-[#0f172a] px-3 py-1.5 font-mono text-[10px] uppercase text-[#38bdf8] hover:bg-[#1e3a5f]/30 disabled:opacity-40"
            >
              Gerar com este prompt
            </button>
            <button
              type="button"
              onClick={() => setPhase({ kind: "idle" })}
              className="border border-[#334155] px-3 py-1.5 font-mono text-[10px] uppercase text-[#94a3b8]"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-[10px] text-red-400">{error}</p>}
    </div>
  );
}
